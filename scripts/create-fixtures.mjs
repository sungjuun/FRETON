import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const rate = Number(process.argv[2] ?? 48000)
if (!Number.isInteger(rate) || rate < 8000 || rate > 192000)
  throw Error('8000~192000 Hz 범위의 정수 샘플레이트를 지정하세요.')
const output = new URL('../.local/test-audio/', import.meta.url)
await mkdir(output, { recursive: true })
function pcm(frames, sample) {
  const b = Buffer.alloc(44 + frames * 2)
  b.write('RIFF')
  b.writeUInt32LE(b.length - 8, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(frames * 2, 40)
  for (let i = 0; i < frames; i++) b.writeInt16LE(Math.round(sample(i) * 32767), 44 + 2 * i)
  return b
}
const burst = pcm(rate * 4, (i) => {
  const t = i / rate
  return (
    0.3 *
    Math.sin(2 * Math.PI * 220 * t) *
    Math.exp(-6 * (t % 1)) *
    Math.min(1, (t % 1) * 200, (4 - t) * 200)
  )
})
const fir = pcm(Math.round(rate * 0.03), (i) =>
  i === 0
    ? 0.6
    : i === Math.round(rate * 0.003)
      ? -0.32
      : i === Math.round(rate * 0.007)
        ? 0.12
        : 0,
)
await writeFile(new URL('test-burst-' + rate + '.wav', output), burst)
await writeFile(new URL('test-fir-' + rate + '.wav', output), fir)
for (const coefficient of [0.25, 0.5]) {
  const model = {
    version: '0.5.4',
    architecture: 'Linear',
    config: { receptive_field: 1, bias: false },
    weights: [coefficient],
    sample_rate: rate,
    metadata: { name: 'FRETON linear DSP test' },
  }
  await writeFile(
    new URL('linear-' + coefficient + '-' + rate + '.nam', output),
    JSON.stringify(model, null, 2) + '\n',
  )
}
console.log('자체 생성 WAV 2개와 선형 NAM 2개 · ' + fileURLToPath(output))
