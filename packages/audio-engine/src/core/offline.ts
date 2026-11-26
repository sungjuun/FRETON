import { chorusBaseDelayMs, DspGraph, registerNoiseGate } from '../effects/graph'
import type { ChainStage, Settings } from '../presets/config'
export interface RenderOptions {
  source: AudioBuffer
  sampleRate?: number
  settings: Settings
  order?: readonly ChainStage[]
  level: number
  master: number
  dry: boolean
  ir?: AudioBuffer
  tail?: number
}
export async function renderAudio({
  source,
  sampleRate = source.sampleRate,
  settings,
  order,
  level,
  master,
  dry,
  ir,
  tail,
}: RenderOptions) {
  const repeats = settings.delay.values.feedback / 100
  const delayTail =
    settings.delay.enabled && settings.delay.values.mix > 0
      ? (settings.delay.values.time / 1000) *
        (repeats === 0 ? 1 : 1 + Math.ceil(Math.log(0.001) / Math.log(repeats)))
      : 0
  const chorus = settings.chorus
  const chorusTail =
    chorus.enabled && chorus.values.mix > 0 ? (chorusBaseDelayMs + chorus.values.depth) / 1000 : 0
  const seconds = dry
    ? 0
    : (tail ??
      delayTail +
        chorusTail +
        (settings.reverb.enabled ? settings.reverb.values.decay : 0) +
        (ir?.duration ?? 0))
  const channels = Math.max(
    source.numberOfChannels,
    !dry && (settings.reverb.enabled || ir?.numberOfChannels === 2) ? 2 : 1,
  )
  const length = Math.round(source.duration * sampleRate) + Math.ceil(seconds * sampleRate)
  if (length * channels > 24_000_000)
    throw Error('오프라인 렌더 메모리 한도를 초과했습니다. 짧은 클립을 선택하세요.')
  const ctx = new OfflineAudioContext(channels, length, sampleRate)
  const useGate = !dry && settings.noiseGate.enabled
  if (useGate) await registerNoiseGate(ctx)
  const node = ctx.createBufferSource(),
    gain = ctx.createGain(),
    graph = new DspGraph(ctx, settings, order, useGate)
  try {
    gain.gain.value = level
    node.buffer = source
    node.connect(gain).connect(graph.input)
    graph.bypass(dry, true)
    graph.volume(master, false, true)
    if (!dry && ir) graph.setIR(ir, true, true)
    graph.output.connect(ctx.destination)
    node.start()
    const output = await ctx.startRendering()
    if (useGate && !graph.noiseGateReady)
      throw Error('Noise Gate 처리 오류로 WAV를 내보낼 수 없습니다.')
    return output
  } finally {
    node.disconnect()
    gain.disconnect()
    graph.dispose()
  }
}
