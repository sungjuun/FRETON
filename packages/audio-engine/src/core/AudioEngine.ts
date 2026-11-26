import { DspGraph, registerNoiseGate, smooth } from '../effects/graph'
import { factoryPresets, dbToGain, type Preset } from '../presets/config'
import { signalBuffer, type Signal, type Source } from '../inputs/signals'
import { TestSignalInput } from '../inputs/TestSignalInput'
import { FileInput, type AudioInput } from '../inputs/FileInput'
import { LiveInput, requestInput, type Channel } from '../inputs/LiveInput'
import { NamSlot, type NamInfo } from '../amps/nam'
import { decodeIR, type IRInfo } from '../cabinet/ir'
import { renderAudio } from './offline'
import { sameAsset, verifyRestore } from '../utils/fingerprint'

export const engineSampleRates = [44100, 48000, 96000] as const
export class AudioEngine extends EventTarget {
  ctx?: AudioContext
  graph?: DspGraph
  inputMeter?: AnalyserNode
  outputMeter?: AnalyserNode
  private inputGain?: GainNode
  private input?: AudioInput
  private namSlot?: NamSlot
  private queue = Promise.resolve()
  private generation = 0
  private closing = false
  private liveRequest = 0
  private fileRequest = 0
  private irRequest = 0
  private namRequest = 0
  requestedSampleRate?: number
  preset: Preset = structuredClone(factoryPresets[0])
  source: Source = 'guitar'
  signal: Signal = 'sine'
  frequency = 220
  level = -12
  master = -24
  muted = false
  bypassed = false
  dry = false
  monitor = false
  channel: Channel = 'mono'
  loop = false
  fileBuffer?: AudioBuffer
  fileName = ''
  fileSize = 0
  file?: FileInput
  live?: LiveInput
  livePending = false
  irBuffer?: AudioBuffer
  irInfo?: IRInfo
  namInfo?: NamInfo
  busy = false
  namBusy = false
  errors: string[] = []
  sink = ''
  revision = 0
  changed = () => {
    this.revision++
    this.dispatchEvent(new Event('change'))
  }
  report = (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error)
    this.errors = [msg, ...this.errors].slice(0, 8)
    this.changed()
  }
  private enqueue<T>(fn: () => Promise<T>) {
    const task = this.queue.then(fn)
    this.queue = task.then(
      () => {},
      () => {},
    )
    return task
  }
  async start() {
    if (this.busy) return
    if (this.ctx) {
      await this.ctx.resume()
      return
    }
    this.busy = true
    this.changed()
    try {
      const ctx = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: this.requestedSampleRate,
      })
      this.ctx = ctx
      ctx.onstatechange = this.changed
      await ctx.resume()
      let gateRegistered = false
      try {
        await registerNoiseGate(ctx)
        gateRegistered = true
      } catch {
        this.report('Noise Gate를 준비할 수 없어 게이트를 우회합니다. 엔진을 재시작하세요.')
      }
      this.graph = new DspGraph(
        ctx,
        this.preset.settings,
        this.preset.order,
        gateRegistered,
        this.report,
      )
      this.inputGain = ctx.createGain()
      this.inputGain.gain.value = dbToGain(this.level)
      this.inputMeter = ctx.createAnalyser()
      this.outputMeter = ctx.createAnalyser()
      this.inputMeter.fftSize = this.outputMeter.fftSize = 2048
      this.inputGain.connect(this.inputMeter).connect(this.graph.input)
      this.graph.output.connect(this.outputMeter).connect(ctx.destination)
      this.namSlot = new NamSlot(ctx, this.graph.nam, () => {
        this.namInfo = undefined
        this.report('NAM 프로세서 오류 · 기본 DSP 경로로 전환했습니다. 모델을 다시 선택하세요.')
      })
      if (this.irBuffer && this.irBuffer.sampleRate !== ctx.sampleRate) {
        this.irBuffer = undefined
        this.irInfo = undefined
      }
      this.master = Math.min(this.master, -24)
      this.attachInput()
      this.sync(true)
    } catch (e) {
      await this.close()
      throw e
    } finally {
      this.busy = false
      this.changed()
    }
  }
  private async close() {
    this.closing = true
    this.generation++
    this.detachInput()
    const ctx = this.ctx
    try {
      if (ctx && this.graph) this.graph.volume(this.master, true)
      await this.enqueue(async () => {
        await this.namSlot?.remove()
      })
    } finally {
      this.namSlot = undefined
      this.namInfo = undefined
      this.monitor = false
      this.sink = ''
      this.graph?.dispose()
      this.graph = undefined
      this.inputGain?.disconnect()
      this.inputMeter?.disconnect()
      this.outputMeter?.disconnect()
      this.inputGain = this.inputMeter = this.outputMeter = undefined
      this.ctx = undefined
      this.closing = false
      if (ctx) {
        ctx.onstatechange = null
        if (ctx.state !== 'closed') await ctx.close()
      }
    }
  }
  async stop() {
    if (this.busy) return
    this.busy = true
    this.changed()
    try {
      await this.close()
    } finally {
      this.busy = false
      this.changed()
    }
  }
  private detachInput() {
    this.liveRequest++
    this.livePending = false
    this.input?.disconnect()
    this.input = undefined
    this.file = undefined
    this.live = undefined
    this.channel = 'mono'
    this.monitor = false
  }
  private attachInput() {
    const ctx = this.ctx,
      target = this.inputGain
    if (!ctx || !target || this.closing) return
    if (this.source === 'guitar' || this.source === 'test') {
      this.input = new TestSignalInput(
        ctx,
        this.source === 'guitar' ? 'guitar' : this.signal,
        this.frequency,
        target,
      )
    }
    if (this.source === 'file' && this.fileBuffer) {
      this.file = new FileInput(ctx, this.fileBuffer, target, this.changed)
      this.file.loop = this.loop
      this.input = this.file
    }
  }
  selectSource(value: Source) {
    if (this.source === value) return
    this.fileRequest++
    this.detachInput()
    this.source = value
    this.attachInput()
    this.sync()
  }
  setSignal(kind: Signal, frequency: number) {
    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 8000)
      throw Error('주파수 범위는 20~8000 Hz입니다.')
    this.signal = kind
    this.frequency = frequency
    if (this.source === 'test' || this.source === 'guitar') {
      this.detachInput()
      this.attachInput()
    }
    this.changed()
  }
  private running() {
    if (!this.ctx || !this.graph || this.busy) throw Error('먼저 오디오 엔진을 시작하세요.')
    return this.ctx
  }
  async loadFile(file: File) {
    const ctx = this.running(),
      ticket = ++this.fileRequest
    if (file.size > 100 * 1024 ** 2) throw Error('100 MiB 이하의 오디오 파일을 선택하세요.')
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
    if (this.ctx !== ctx || this.busy || ticket !== this.fileRequest) return
    this.detachInput()
    this.source = 'file'
    this.fileBuffer = buffer
    this.fileName = file.name
    this.fileSize = file.size
    this.attachInput()
    this.sync()
  }
  clearFile() {
    this.fileRequest++
    if (this.source === 'file') this.detachInput()
    this.fileBuffer = undefined
    this.fileName = ''
    this.fileSize = 0
    this.changed()
  }
  async connectLive(id: string) {
    const ctx = this.running()
    this.selectSource('live')
    this.detachInput()
    const ticket = ++this.liveRequest
    this.livePending = true
    this.sync()
    let stream: MediaStream | undefined
    try {
      stream = await requestInput(id)
      if (ticket !== this.liveRequest || !this.inputGain) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.live = new LiveInput(ctx, stream, this.inputGain, () => {
        this.removeLive()
        this.report('입력 장치 연결이 해제되었습니다.')
      })
      this.input = this.live
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop())
      if (ticket === this.liveRequest) throw e
    } finally {
      if (ticket === this.liveRequest) {
        this.livePending = false
        this.changed()
      }
    }
  }
  removeLive() {
    if (this.source === 'live') {
      this.detachInput()
      this.sync()
    }
  }
  setChannel(value: Channel) {
    this.live?.channel(value)
    this.channel = value
    this.changed()
  }
  setMonitor(value: boolean) {
    this.monitor = !!this.live && value
    this.sync()
  }
  setMute(value: boolean) {
    this.muted = value
    this.sync()
  }
  setMaster(value: number) {
    if (Number.isFinite(value)) {
      this.master = Math.max(-60, Math.min(0, value))
      this.sync()
    }
  }
  setSampleRate(value: number | undefined) {
    if (value !== undefined && !engineSampleRates.some((rate) => rate === value))
      throw Error('지원하지 않는 엔진 샘플레이트입니다.')
    this.requestedSampleRate = value
    this.changed()
  }
  setLevel(value: number) {
    if (Number.isFinite(value)) {
      this.level = Math.max(-60, Math.min(0, value))
      this.sync()
    }
  }
  setDry(value: boolean) {
    this.dry = value
    this.sync()
  }
  setBypass(value: boolean) {
    this.bypassed = value
    this.sync()
  }
  setLoop(value: boolean) {
    this.loop = value
    this.file?.setLoop(value)
    this.changed()
  }
  async setOutput(id: string) {
    const ctx = this.running() as AudioContext & { setSinkId?(id: string): Promise<void> }
    if (!ctx.setSinkId) throw Error('출력 장치 선택을 지원하지 않습니다.')
    await ctx.setSinkId(id)
    if (ctx === this.ctx) {
      this.sink = id
      this.changed()
    }
  }
  setPreset(preset: Preset) {
    this.preset = preset
    this.sync()
  }
  assetReady(kind: 'nam' | 'ir') {
    const ref = this.preset[kind]
    const info = kind === 'nam' ? this.namInfo : this.irInfo
    return !!ref && !!info && sameAsset(ref, info)
  }
  sync(initial = false) {
    this.graph?.setOrder(this.preset.order)
    this.graph?.update(this.preset.settings)
    this.graph?.bypass(this.bypassed || this.dry, initial)
    this.graph?.volume(
      this.master,
      this.closing || this.muted || (this.source === 'live' && !this.monitor),
      initial,
    )
    if (this.inputGain && this.ctx)
      smooth(this.inputGain.gain, dbToGain(this.level), this.ctx, initial)
    const { ir, nam } = this.preset
    this.graph?.setIR(this.irBuffer ?? null, !!(ir?.enabled && this.assetReady('ir')), initial)
    this.graph?.nam.mix(
      nam?.enabled && this.namSlot?.loaded && this.assetReady('nam') ? 1 : 0,
      initial,
    )
    this.changed()
  }
  async loadNam(
    source: File | { name: string; sha256: string; readFile: () => Promise<File> },
    restore = false,
  ) {
    this.running()
    const slot = this.namSlot!
    const original = this.preset
    const ticket = ++this.namRequest
    const gen = this.generation
    const current = () =>
      gen === this.generation &&
      ticket === this.namRequest &&
      original.id === this.preset.id &&
      original.nam === this.preset.nam
    this.namBusy = true
    this.changed()
    try {
      await this.enqueue(async () => {
        if (!current()) return
        const expected = restore ? (original.nam ?? undefined) : undefined
        const stored = 'readFile' in source
        if (stored) verifyRestore(expected, source)
        const file = stored ? await source.readFile() : source
        if (!current()) return
        const candidate = await slot.prepare(file, stored ? source : expected)
        if (!current()) {
          await candidate.discard()
          return
        }
        const { info } = candidate
        const previous = original.nam && sameAsset(original.nam, info) ? original.nam : null
        const retiring = slot.install(candidate.node)
        this.namInfo = info
        this.preset = {
          ...this.preset,
          nam: {
            name: info.name,
            sha256: info.sha256,
            enabled: previous?.enabled ?? true,
            capture: previous?.capture ?? info.capture,
          },
        }
        this.sync()
        await retiring
      })
    } finally {
      if (ticket === this.namRequest) this.namBusy = false
      this.changed()
    }
  }
  async removeNam() {
    const original = this.preset
    this.namRequest++
    this.namBusy = false
    await this.enqueue(async () => {
      if (this.preset.id !== original.id || this.preset.nam !== original.nam) return
      const loaded = this.assetReady('nam')
      try {
        if (loaded) await this.namSlot?.remove()
      } finally {
        if (loaded) this.namInfo = undefined
        if (this.preset.id === original.id && this.preset.nam === original.nam)
          this.preset = { ...this.preset, nam: null }
        this.sync()
      }
    })
  }
  async loadIR(file: File, restore = false) {
    const ctx = this.running(),
      ticket = ++this.irRequest,
      original = this.preset
    const { buffer, info } = await decodeIR(ctx, file)
    if (
      ctx !== this.ctx ||
      this.busy ||
      ticket !== this.irRequest ||
      this.preset.id !== original.id ||
      this.preset.ir !== original.ir
    )
      return
    if (restore) verifyRestore(original.ir ?? undefined, info)
    const previous = original.ir && sameAsset(original.ir, info) ? original.ir : null
    this.irBuffer = buffer
    this.irInfo = info
    this.preset = {
      ...this.preset,
      ir: { name: file.name, sha256: info.sha256, enabled: previous?.enabled ?? true },
    }
    this.sync()
  }
  removeIR() {
    this.irRequest++
    if (this.assetReady('ir')) {
      this.irBuffer = undefined
      this.irInfo = undefined
    }
    this.preset = { ...this.preset, ir: null }
    this.sync()
  }
  async exportAudio(dry: boolean) {
    const ctx = this.running()
    if (this.source === 'live') throw Error('파일 또는 생성 신호를 선택하세요.')
    const bypass = dry || this.bypassed || this.dry
    if (!bypass && this.preset.nam?.enabled)
      throw Error('NAM 오프라인 렌더링은 지원하지 않습니다. NAM을 끄고 다시 시도하세요.')
    if (!bypass && this.preset.ir?.enabled && !this.assetReady('ir'))
      throw Error('프리셋의 IR 파일을 다시 선택하세요.')
    const source =
      this.source === 'file'
        ? this.fileBuffer
        : signalBuffer(ctx, this.source === 'guitar' ? 'guitar' : this.signal, this.frequency)
    if (!source) throw Error('오디오 파일을 선택하세요.')
    return renderAudio({
      source,
      sampleRate: ctx.sampleRate,
      settings: this.preset.settings,
      order: this.preset.order,
      level: dbToGain(this.level),
      master: this.master,
      dry: bypass,
      ir: this.preset.ir?.enabled ? this.irBuffer : undefined,
    })
  }
}
