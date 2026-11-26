import { defaults, renderAudio, seededRandom } from '@freton/audio-engine'

export async function checkGate(rate: number) {
  const settings = defaults()
  for (const mod of Object.values(settings)) mod.enabled = false
  settings.noiseGate = {
    enabled: true,
    values: { threshold: -30, attack: 10, hold: 50, release: 120 },
  }
  const source = new AudioBuffer({ sampleRate: rate, length: rate, numberOfChannels: 2 })
  const left = source.getChannelData(0),
    right = source.getChannelData(1)
  const random = seededRandom()
  for (let i = 0; i < rate; i++) {
    const t = i / rate
    let amplitude = 0.003
    if (t >= 0.08 && t < 0.18) amplitude = 0.25
    if (t >= 0.18 && t < 0.33) amplitude = 0.25 * (0.024 / 0.25) ** ((t - 0.18) / 0.15)
    if ((t >= 0.33 && t < 0.42) || (t >= 0.7 && t < 0.79)) amplitude = 0.024
    const sine = Math.sin(2 * Math.PI * 750 * t)
    left[i] = amplitude * sine
    right[i] = -(t >= 0.8 ? 0.22 : amplitude) * sine
    if (t < 0.08) {
      left[i] = 0.003 * (2 * random() - 1)
      right[i] = -left[i]
    }
  }
  const rendered = await renderAudio({ settings, source, master: 0, level: 1, dry: false })
  const wet = rendered.getChannelData(0)
  function gain(from: number, to: number) {
    let input = 0,
      output = 0
    for (let i = Math.round(rate * from); i < Math.round(rate * to); i++) {
      input += left[i] ** 2
      output += wet[i] ** 2
    }
    return Math.sqrt(output / input)
  }
  const inverted = rendered.getChannelData(1)
  return {
    rate,
    noise: gain(0.02, 0.06),
    opening: gain(0.082, 0.084),
    sustain: gain(0.13, 0.17),
    decay: gain(0.2, 0.32),
    hysteresisOpen: gain(0.35, 0.4),
    hold: gain(0.45, 0.46),
    releasing: gain(0.49, 0.5),
    lateRelease: gain(0.55, 0.56),
    closed: gain(0.62, 0.68),
    hysteresisClosed: gain(0.72, 0.76),
    linked: gain(0.86, 0.9),
    oppositePhase: wet
      .subarray(0, Math.round(0.79 * rate))
      .every((x, i) => Math.abs(x + inverted[i]) < 0.00001),
  }
}
