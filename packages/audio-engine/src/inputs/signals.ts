export const signals = [
  'sine',
  'square',
  'triangle',
  'noise',
  'impulse',
  'sweep',
  'silence',
  'guitar',
] as const
export type Signal = (typeof signals)[number]
export type Source = 'test' | 'guitar' | 'file' | 'live'
export function seededRandom(seed = 17381) {
  let s = seed
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}
export function signalBuffer(ctx: BaseAudioContext, kind: Signal, frequency = 220, seconds = 2) {
  const sr = ctx.sampleRate
  if (
    !Number.isFinite(frequency) ||
    frequency < 20 ||
    frequency > 8000 ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 30
  )
    throw Error('신호 범위 오류')
  const buffer = ctx.createBuffer(1, Math.ceil(sr * seconds), sr),
    samples = buffer.getChannelData(0),
    random = seededRandom()
  const count = Math.max(2, Math.round(sr / frequency)),
    ring = new Float32Array(count)
  let phase = 0
  for (let i = 0; i < samples.length; i++) {
    const f =
      kind === 'sweep'
        ? frequency * Math.pow(Math.min(18000, sr * 0.45) / frequency, i / samples.length)
        : frequency
    phase = (phase + f / sr) % 1
    let value = 0
    switch (kind) {
      case 'sine':
      case 'sweep':
        value = Math.sin(phase * 2 * Math.PI)
        break
      case 'square':
        value = phase < 0.5 ? 1 : -1
        break
      case 'triangle':
        value = 1 - 4 * Math.abs(phase - 0.5)
        break
      case 'noise':
        value = random() * 2 - 1
        break
      case 'impulse':
        value = i === 0 ? 1 : 0
        break
      case 'guitar': {
        // A seeded burst excites a lossy delay line every half second.
        if (i % Math.round(sr * 0.5) === 0)
          for (let n = 0; n < count; n++) ring[n] = random() * 2 - 1
        const k = i % count
        value = ring[k]
        ring[k] = 0.498 * (value + ring[(k + 1) % count])
        break
      }
    }
    const edge =
      kind === 'impulse'
        ? 1
        : Math.min(1, i / (sr * 0.003), (samples.length - 1 - i) / (sr * 0.003))
    samples[i] = value * edge
  }
  return buffer
}
export function impulseResponse(ctx: BaseAudioContext, seconds: number) {
  const frames = Math.max(1, Math.round(ctx.sampleRate * seconds)),
    buffer = ctx.createBuffer(2, frames, ctx.sampleRate),
    random = seededRandom(712)
  for (let ch = 0; ch < 2; ch++) {
    const a = buffer.getChannelData(ch)
    for (let i = 0; i < frames; i++) a[i] = (random() * 2 - 1) * Math.pow(1 - i / frames, 3)
  }
  return buffer
}
