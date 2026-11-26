import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

export async function downloadFile(page: Page, label: string) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: label, exact: true }).click()
  return readFile((await (await download).path())!)
}

export function audioWav(rate = 44100, channels = 1, frequency = 220) {
  const frames = Math.floor(rate / 2),
    bytes = frames * 2 * channels,
    b = Buffer.alloc(44 + bytes)
  b.write('RIFF')
  b.writeUInt32LE(bytes + 36, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(channels, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2 * channels, 28)
  b.writeUInt16LE(channels * 2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(bytes, 40)
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++)
      b.writeInt16LE(
        Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 5000),
        44 + (i * channels + c) * 2,
      )
  return b
}
