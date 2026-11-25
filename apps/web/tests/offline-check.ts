import { defaults, factoryPresets, moduleIds, type Settings } from '@freton/audio-engine'
import { renderAudio, signalBuffer, signals } from '@freton/audio-engine'
export async function verify() {
  const ctx = new OfflineAudioContext(1, 48000, 48000)
  const clean = defaults()
  moduleIds.forEach((id) => (clean[id].enabled = false))
  const validSignals = signals.every((kind) => {
    const a = signalBuffer(ctx, kind, 220).getChannelData(0)
    return (
      a.every((v) => Number.isFinite(v) && Math.abs(v) <= 1) &&
      (kind === 'silence' ? a.every((v) => v === 0) : a.some((v) => Math.abs(v) > 0.01))
    )
  })
  const render = async (
    settings: Settings,
    frequency = 200,
    kind: 'sine' | 'impulse' | 'guitar' = 'sine',
    dry = false,
    level = 0.15,
  ) => {
    const source = signalBuffer(ctx, kind, frequency, 1)
    return (await renderAudio({ source, settings, master: 0, level, dry, tail: 0 })).getChannelData(
      0,
    )
  }
  const base = await render(clean)
  const change = (id: keyof Settings, values: Record<string, number>) => {
    const s = structuredClone(clean)
    s[id] = { enabled: true, values: { ...s[id].values, ...values } }
    return s
  }
  const amplified = await render(change('input', { gain: 6 }))
  const low = await render(change('eq', { bass: 10 }), 40),
    lowBase = await render(clean, 40)
  const nonlinear = await render(change('distortion', { gain: 90 }))
  const drive = await render(change('overdrive', { drive: 70 }))
  const compressor = change('compressor', { threshold: -40, ratio: 12, attack: 3, knee: 0 })
  // The node includes automatic makeup gain. Measure the change in dynamic range.
  const soft = await render(compressor, 200, 'sine', false, 0.025),
    loudComp = await render(compressor, 200, 'sine', false, 0.2)
  const softDry = await render(clean, 200, 'sine', false, 0.025),
    loudDry = await render(clean, 200, 'sine', false, 0.2)
  const delay = await render(change('delay', { time: 100, mix: 50, feedback: 50 }), 220, 'impulse'),
    room = await render(change('reverb', { decay: 1, mix: 60 }), 220, 'impulse')
  const dry = await render(factoryPresets[4].settings, 200, 'sine', true)
  function energy(a: Float32Array, start = 12000, end = 36000) {
    let sum = 0
    for (let i = start; i < end; i++) sum += a[i] ** 2
    return Math.sqrt(sum / (end - start))
  }
  function harmonic(a: Float32Array, f: number) {
    let cos = 0,
      sin = 0
    for (let i = 12000; i < 36000; i++) {
      const angle = (2 * Math.PI * f * i) / 48000
      cos += a[i] * Math.cos(angle)
      sin += a[i] * Math.sin(angle)
    }
    return Math.hypot(cos, sin)
  }
  const prints = new Set<string>()
  let safe = true
  for (const preset of factoryPresets) {
    const a = await render(preset.settings, 220, 'guitar')
    prints.add(energy(a, 0, 24000).toFixed(6))
    safe &&= a.every((x) => Number.isFinite(x) && Math.abs(x) <= 0.98)
  }
  const cabinet = ctx.createBuffer(1, 3000, 48000)
  cabinet.getChannelData(0)[2400] = 1
  const cab = await renderAudio({
    source: signalBuffer(ctx, 'impulse'),
    settings: clean,
    level: 0.3,
    master: 0,
    dry: false,
    ir: cabinet,
    tail: 0,
  })
  const loud = await renderAudio({
    source: signalBuffer(ctx, 'square'),
    settings: change('input', { gain: 18 }),
    level: 1,
    master: 0,
    dry: false,
    tail: 0,
  })
  return {
    validSignals,
    gain: energy(amplified) / energy(base),
    bass: energy(low) / energy(lowBase),
    harmonics: harmonic(nonlinear, 600) / harmonic(nonlinear, 200),
    overdriveThird: harmonic(drive, 600) / harmonic(drive, 200),
    compressorSpanDb: 20 * Math.log10(energy(loudComp) / energy(soft)),
    drySpanDb: 20 * Math.log10(energy(loudDry) / energy(softDry)),
    echo: Math.max(...delay.slice(4700, 4900)),
    room: energy(room, 200, 6000),
    dryError: energy(Float32Array.from(dry, (v, i) => v - base[i])),
    cabinetImpulse: cab.getChannelData(0)[2400],
    cabinetDirect: cab.getChannelData(0)[0],
    protected: loud.getChannelData(0).every((v) => Number.isFinite(v) && Math.abs(v) <= 0.971),
    distinct: prints.size,
    safe,
  }
}
