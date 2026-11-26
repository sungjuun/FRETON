import { defaults, renderAudio } from '@freton/audio-engine'

export async function checkChorus(sampleRate: number) {
  const source = new AudioBuffer({ sampleRate, length: sampleRate, numberOfChannels: 2 })
  const frames = [
    ...Array.from({ length: 11 }, (_, i) => Math.round(i * 0.09 * sampleRate)),
    sampleRate - 1,
  ]
  for (const i of frames) {
    source.getChannelData(0)[i] = 0.4
    source.getChannelData(1)[i] = -0.2
  }
  const settings = defaults()
  for (const mod of Object.values(settings)) mod.enabled = false
  settings.chorus = { enabled: true, values: { rate: 2, depth: 6, mix: 35 } }
  const options = { source, settings, level: 1, master: 0, dry: false }
  const wet = await renderAudio(options)
  const left = wet.getChannelData(0),
    right = wet.getChannelData(1)
  const delays: number[] = []
  let maxError = 0
  for (const frame of frames) {
    let peak = frame + 1
    for (let i = peak; i < Math.min(left.length, frame + 0.025 * sampleRate); i++) {
      if (left[i] > left[peak]) peak = i
    }
    const expectedMs = 15 + 6 * Math.sin((2 * Math.PI * 2 * peak) / sampleRate)
    const measuredMs = (1000 * (peak - frame)) / sampleRate
    maxError = Math.max(maxError, Math.abs(measuredMs - expectedMs))
    delays.push(measuredMs)
  }
  const dry = await renderAudio({ ...options, dry: true })
  settings.chorus.values.mix = 0
  const zeroMix = await renderAudio(options)
  const same = (a: AudioBuffer, b: AudioBuffer) =>
    a.length === b.length &&
    [0, 1].every((ch) => {
      const other = b.getChannelData(ch)
      return a.getChannelData(ch).every((x, i) => x === other[i])
    })
  return {
    sampleRate,
    minMs: Math.min(...delays),
    maxMs: Math.max(...delays),
    maxErrorMs: maxError,
    dryGain: left[frames[1]] / 0.4,
    stereo: left.every((x, i) => Math.abs(x / 2 + right[i]) < 0.00001),
    tailFrames: wet.length - source.length,
    lastTap: Math.max(...left.subarray(source.length)),
    zeroMixMatchesDry: same(zeroMix, dry),
  }
}
