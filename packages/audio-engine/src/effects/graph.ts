import {
  assertChainOrder,
  dbToGain,
  defaultOrder,
  moduleIds,
  type ChainStage,
  type ModuleId,
  type Settings,
} from '../presets/config'
import { impulseResponse } from '../inputs/signals'
const rampSeconds = 0.008
export function smooth(p: AudioParam, value: number, ctx: BaseAudioContext, initial = false) {
  if (initial) {
    p.value = value
    return
  }
  const time = ctx.currentTime
  p.cancelAndHoldAtTime(time)
  p.linearRampToValueAtTime(value, time + rampSeconds)
}
export function driveCurve(hard: boolean) {
  const curve = new Float32Array(4097)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = hard ? Math.max(-0.65, Math.min(0.65, x * 1.8)) : Math.tanh(x * 2.4) / Math.tanh(2.4)
  }
  return curve
}
// The two gains are complementary so identical wet and dry signals sum to unity.
export class SwitchPath {
  readonly input: GainNode
  readonly output: GainNode
  readonly send: GainNode
  readonly receive: GainNode
  private direct: GainNode
  constructor(
    private ctx: BaseAudioContext,
    amount: number,
  ) {
    this.input = ctx.createGain()
    this.output = ctx.createGain()
    this.direct = ctx.createGain()
    this.send = ctx.createGain()
    this.receive = ctx.createGain()
    this.input.connect(this.direct).connect(this.output)
    this.input.connect(this.send)
    this.receive.connect(this.output)
    this.mix(amount, true)
  }
  mix(amount: number, initial = false) {
    smooth(this.direct.gain, 1 - amount, this.ctx, initial)
    smooth(this.receive.gain, amount, this.ctx, initial)
  }
  disconnect() {
    for (const n of [this.input, this.output, this.direct, this.send, this.receive]) n.disconnect()
  }
}
export class DspGraph {
  readonly input: GainNode
  readonly output: GainNode
  readonly nam: SwitchPath
  readonly cabinet: SwitchPath
  private master: GainNode
  private paths: Record<ModuleId, SwitchPath>
  private main: SwitchPath
  private chainGate: GainNode
  private order: readonly ChainStage[] = []
  private requestedOrder: readonly ChainStage[]
  private transition?: ConstantSourceNode
  private nodes: AudioNode[] = []
  private gain: GainNode
  private compressor: DynamicsCompressorNode
  private shapers: Record<
    'overdrive' | 'distortion',
    { pre: GainNode; filter: BiquadFilterNode; post: GainNode }
  >
  private filters: BiquadFilterNode[]
  private echo: DelayNode
  private feedback: GainNode
  private room: ConvolverNode
  private ir: ConvolverNode
  private previous?: Settings
  constructor(
    private ctx: BaseAudioContext,
    settings: Settings,
    order: readonly ChainStage[] = defaultOrder,
  ) {
    assertChainOrder(order)
    const track = <T extends AudioNode>(n: T) => {
      this.nodes.push(n)
      return n
    }
    this.main = new SwitchPath(ctx, 1)
    this.input = this.main.input
    this.paths = Object.fromEntries(moduleIds.map((id) => [id, new SwitchPath(ctx, 1)])) as Record<
      ModuleId,
      SwitchPath
    >
    this.nam = new SwitchPath(ctx, 0)
    this.cabinet = new SwitchPath(ctx, 0)
    const { input, compressor, eq, delay, reverb } = this.paths
    this.chainGate = track(ctx.createGain())
    this.main.send.connect(input.input)
    this.chainGate.connect(this.main.receive)
    this.requestedOrder = order
    this.applyOrder(order)
    this.gain = track(ctx.createGain())
    input.send.connect(this.gain).connect(input.receive)
    this.compressor = track(ctx.createDynamicsCompressor())
    compressor.send.connect(this.compressor).connect(compressor.receive)
    const shape = (id: 'overdrive' | 'distortion') => {
      const path = this.paths[id],
        pre = track(ctx.createGain()),
        ws = track(ctx.createWaveShaper()),
        filter = track(ctx.createBiquadFilter()),
        post = track(ctx.createGain())
      ws.curve = driveCurve(id === 'distortion')
      ws.oversample = '2x'
      filter.type = 'lowpass'
      filter.Q.value = 0.707
      path.send.connect(pre).connect(ws).connect(filter).connect(post).connect(path.receive)
      return { pre, filter, post }
    }
    this.shapers = { overdrive: shape('overdrive'), distortion: shape('distortion') }
    this.ir = track(ctx.createConvolver())
    this.cabinet.send.connect(this.ir).connect(this.cabinet.receive)
    this.filters = (['lowshelf', 'peaking', 'highshelf'] as const).map((type, i) => {
      const f = track(ctx.createBiquadFilter())
      f.type = type
      f.frequency.value = [120, 800, 3500][i]
      f.Q.value = 0.8
      return f
    })
    eq.send
      .connect(this.filters[0])
      .connect(this.filters[1])
      .connect(this.filters[2])
      .connect(eq.receive)
    this.echo = track(ctx.createDelay(1.1))
    this.feedback = track(ctx.createGain())
    delay.send.connect(this.echo).connect(delay.receive)
    this.echo.connect(this.feedback).connect(this.echo)
    this.room = track(ctx.createConvolver())
    reverb.send.connect(this.room).connect(reverb.receive)
    this.master = track(ctx.createGain())
    this.master.gain.value = 0
    // Transparent below the headroom threshold; the endpoint also bounds overs.
    const guard = track(ctx.createWaveShaper())
    guard.curve = Float32Array.from({ length: 4097 }, (_, i) =>
      Math.max(-0.97, Math.min(0.97, i / 2048 - 1)),
    )
    this.output = track(ctx.createGain())
    this.main.output.connect(this.master).connect(guard).connect(this.output)
    this.update(settings, true)
  }
  private stage(id: ChainStage): SwitchPath {
    return id === 'nam' || id === 'cabinet' ? this[id] : this.paths[id]
  }
  private applyOrder(order: readonly ChainStage[]) {
    // Remove every old inter-stage edge before connecting any reversed pair.
    let last = this.paths.input.output
    if (this.order.length) {
      for (const id of this.order) {
        const path = this.stage(id)
        last.disconnect(path.input)
        last = path.output
      }
      last.disconnect(this.chainGate)
    }
    last = this.paths.input.output
    for (const id of order) {
      const path = this.stage(id)
      last.connect(path.input)
      last = path.output
    }
    last.connect(this.chainGate)
    this.order = order
  }
  setOrder(order: readonly ChainStage[]) {
    if (order === this.requestedOrder) return
    assertChainOrder(order)
    this.requestedOrder = order
    if (this.transition || this.order.every((id, i) => id === order[i])) return
    if (this.ctx.state !== 'running') {
      this.applyOrder(order)
      return
    }
    // Use the audio clock so a suspended tab cannot rewire ahead of the fade.
    const clock = this.ctx.createConstantSource()
    this.transition = clock
    smooth(this.chainGate.gain, 0, this.ctx)
    clock.onended = () => {
      this.transition = undefined
      clock.onended = null
      if (!this.order.every((id, i) => id === this.requestedOrder[i]))
        this.applyOrder(this.requestedOrder)
      smooth(this.chainGate.gain, 1, this.ctx)
    }
    clock.start()
    clock.stop(this.ctx.currentTime + rampSeconds)
  }
  update(settings: Settings, initial = false) {
    const apply = (param: AudioParam, v: number) => smooth(param, v, this.ctx, initial)
    for (const id of moduleIds) {
      const m = settings[id],
        old = this.previous?.[id],
        v = m.values
      if (old === m && !initial) continue
      this.paths[id].mix(
        m.enabled ? (id === 'delay' || id === 'reverb' ? v.mix / 100 : 1) : 0,
        initial,
      )
      switch (id) {
        case 'input':
          apply(this.gain.gain, dbToGain(v.gain))
          break
        case 'compressor':
          apply(this.compressor.threshold, v.threshold)
          apply(this.compressor.ratio, v.ratio)
          apply(this.compressor.attack, v.attack / 1000)
          apply(this.compressor.release, v.release / 1000)
          apply(this.compressor.knee, v.knee)
          break
        case 'overdrive':
        case 'distortion': {
          const sh = this.shapers[id]
          apply(sh.pre.gain, 1 + (id === 'overdrive' ? v.drive * 0.13 : v.gain * 0.38))
          apply(sh.filter.frequency, v.tone)
          apply(sh.post.gain, dbToGain(v.level))
          break
        }
        case 'eq':
          this.filters.forEach((f, i) => apply(f.gain, v[['bass', 'middle', 'treble'][i]]))
          break
        case 'delay':
          apply(this.echo.delayTime, v.time / 1000)
          apply(this.feedback.gain, v.feedback / 100)
          break
        case 'reverb':
          if (old?.values.decay !== v.decay) this.room.buffer = impulseResponse(this.ctx, v.decay)
          break
      }
    }
    this.previous = settings
  }
  setIR(buffer: AudioBuffer | null, enabled: boolean, initial = false) {
    if (this.ir.buffer !== buffer) this.ir.buffer = buffer
    this.cabinet.mix(buffer && enabled ? 1 : 0, initial)
  }
  bypass(value: boolean, initial = false) {
    this.main.mix(value ? 0 : 1, initial)
  }
  volume(db: number, muted: boolean, initial = false) {
    smooth(
      this.master.gain,
      muted ? 0 : dbToGain(Math.max(-60, Math.min(0, db))),
      this.ctx,
      initial,
    )
  }
  dispose() {
    if (this.transition) {
      this.transition.onended = null
      this.transition = undefined
    }
    for (const p of [...Object.values(this.paths), this.nam, this.cabinet, this.main])
      p.disconnect()
    for (const n of this.nodes) n.disconnect()
  }
}
