export function wav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels,
    bytes = buffer.length * channels * 2
  const view = new DataView(new ArrayBuffer(44 + bytes))
  const chars = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  chars(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  chars(8, 'WAVE')
  chars(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  chars(36, 'data')
  view.setUint32(40, bytes, true)
  const planes = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch))
  let pos = 44
  for (let frame = 0; frame < buffer.length; frame++)
    for (const plane of planes) {
      const v = Math.max(-1, Math.min(1, plane[frame]))
      view.setInt16(pos, Math.round(v * (v < 0 ? 32768 : 32767)), true)
      pos += 2
    }
  return new Blob([view.buffer], { type: 'audio/wav' })
}
export function levels(samples: Float32Array) {
  let peak = 0,
    sum = 0
  for (const x of samples) {
    peak = Math.max(peak, Math.abs(x))
    sum += x * x
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, samples.length)), clip: peak >= 0.999 }
}
