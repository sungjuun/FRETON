import type { AudioInput } from './FileInput'
export type Channel = 'mono' | 'left' | 'right'
export class LiveInput implements AudioInput {
  readonly settings: MediaTrackSettings
  readonly name: string
  private source: MediaStreamAudioSourceNode
  private split: ChannelSplitterNode
  private mono: GainNode
  private target: AudioNode
  private connected = true
  private readonly devicesChanged = async () => {
    const device = this.settings.deviceId
    if (!device || device === 'default') return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      if (this.connected && !devices.some((d) => d.kind === 'audioinput' && d.deviceId === device))
        this.ended()
    } catch {
      /* Track ended remains available when the browser restricts device enumeration. */
    }
  }
  constructor(
    ctx: AudioContext,
    private stream: MediaStream,
    target: AudioNode,
    private ended: () => void,
  ) {
    this.target = target
    const track = stream.getAudioTracks()[0]
    this.settings = track.getSettings()
    this.name = track.label
    this.source = ctx.createMediaStreamSource(stream)
    this.split = ctx.createChannelSplitter(2)
    this.mono = ctx.createGain()
    this.mono.channelCount = 1
    this.mono.channelCountMode = 'explicit'
    this.source.connect(this.split)
    this.source.connect(this.mono)
    this.channel('mono')
    track.onended = ended
    navigator.mediaDevices.addEventListener('devicechange', this.devicesChanged)
  }
  channel(ch: Channel) {
    if (ch !== 'mono' && (this.settings.channelCount ?? 0) < 2)
      throw Error('스테레오 채널을 확인할 수 없습니다.')
    this.split.disconnect()
    this.mono.disconnect()
    if (ch === 'mono') this.mono.connect(this.target)
    else this.split.connect(this.target, ch === 'left' ? 0 : 1)
  }
  disconnect() {
    this.connected = false
    navigator.mediaDevices.removeEventListener('devicechange', this.devicesChanged)
    this.stream.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
    this.source.disconnect()
    this.split.disconnect()
    this.mono.disconnect()
  }
}
export function checkMedia() {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    throw Error('보안 연결(HTTPS 또는 localhost)에서 장치 입력을 지원하는 브라우저를 사용하세요.')
  return navigator.mediaDevices
}
export async function requestInput(id: string) {
  try {
    return await checkMedia().getUserMedia({
      audio: {
        deviceId: id ? { exact: id } : undefined,
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    })
  } catch (error) {
    if (error instanceof DOMException) {
      const reasons: Record<string, string> = {
        NotAllowedError: '오디오 입력 권한이 거부되었습니다. 브라우저 사이트 권한을 확인하세요.',
        NotFoundError: '사용 가능한 입력 장치가 없습니다.',
        NotReadableError: '입력 장치를 열 수 없습니다. 연결 상태를 확인하세요.',
        OverconstrainedError: '선택한 장치가 요청한 입력 조건을 지원하지 않습니다.',
      }
      if (reasons[error.name]) throw Error(reasons[error.name], { cause: error })
    }
    throw error
  }
}
