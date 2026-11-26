import { defaults, renderAudio } from '@freton/audio-engine'

export async function checkTremolo(sampleRate: number) {
  const settings = defaults()
  for (const mod of Object.values(settings)) mod.enabled = false
  settings.tremolo = { enabled: true, values: { rate: 4, depth: 65 } }
  const source = new AudioBuffer({ sampleRate, length: sampleRate, numberOfChannels: 2 })
  source.getChannelData(0).fill(0.25)
  source.getChannelData(1).fill(-0.125)
  const options = { source, settings, level: 1, master: 0, dry: false }
  const wet = await renderAudio(options)
  const left = wet.getChannelData(0),
    right = wet.getChannelData(1)
  let min = Infinity,
    max = 0,
    maxError = 0,
    stereoError = 0
  for (let i = 0; i < wet.length; i++) {
    const gain = left[i] / 0.25
    const expected = 0.675 + 0.325 * Math.sin((2 * Math.PI * 4 * i) / sampleRate)
    min = Math.min(min, gain)
    max = Math.max(max, gain)
    maxError = Math.max(maxError, Math.abs(gain - expected))
    stereoError = Math.max(stereoError, Math.abs(gain - right[i] / -0.125))
  }
  const dry = await renderAudio({ ...options, dry: true })
  settings.tremolo.values.depth = 0
  const zero = await renderAudio(options)
  const zeroIsDry = [0, 1].every((ch) => {
    const ref = dry.getChannelData(ch)
    return zero.getChannelData(ch).every((x, i) => x === ref[i])
  })
  return { sampleRate, min, max, maxError, stereoError, zeroIsDry, frames: wet.length }
}
