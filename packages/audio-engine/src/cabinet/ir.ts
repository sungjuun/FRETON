import { fingerprint } from '../utils/fingerprint'
export interface IRInfo {
  name: string
  sha256: string
  sourceRate: number
  channels: number
  duration: number
  renderRate: number
}
export async function decodeIR(ctx: AudioContext, file: File) {
  if (file.size > 32 * 1024 ** 2) throw Error('IR 파일은 최대 32 MiB입니다.')
  const bytes = await file.arrayBuffer(),
    d = new DataView(bytes)
  const tag = (i: number) => String.fromCharCode(...new Uint8Array(bytes, i, 4))
  if (d.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE')
    throw Error('RIFF WAV 형식의 캐비닛 IR을 선택하세요.')
  let sourceRate = 0,
    channels = 0
  for (let p = 12; p + 8 <= bytes.byteLength;) {
    const size = d.getUint32(p + 4, true)
    if (size > bytes.byteLength - p - 8) throw Error('손상된 WAV 청크입니다.')
    if (tag(p) === 'fmt ' && size >= 16) {
      channels = d.getUint16(p + 10, true)
      sourceRate = d.getUint32(p + 12, true)
      break
    }
    p += 8 + size + (size % 2)
  }
  if (![1, 2].includes(channels) || !sourceRate)
    throw Error('모노 또는 스테레오 WAV IR이 필요합니다.')
  const hash = await fingerprint(bytes),
    buffer = await ctx.decodeAudioData(bytes)
  if (buffer.duration > 10) throw Error('캐비닛 IR은 10초 이하로 선택하세요.')
  const info: IRInfo = {
    name: file.name,
    sha256: hash,
    sourceRate,
    channels,
    duration: buffer.duration,
    renderRate: buffer.sampleRate,
  }
  return { buffer, info }
}
