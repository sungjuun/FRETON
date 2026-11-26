import { expect, test, type Page } from '@playwright/test'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
import { audioWav, downloadFile } from './audio-wav'

test('Tremolo 실제 스테레오 렌더의 깊이·주기·극성과 Depth 0 원음을 측정한다', async ({ page }) => {
  await page.goto('/sandbox')
  for (const rate of [44100, 48000, 96000]) {
    const result = await page.evaluate(async (rate) => {
      const { checkTremolo }: typeof import('../apps/web/tests/tremolo-check') = await import(
        /* @vite-ignore */ '/tests/tremolo-check.ts' as string
      )
      return checkTremolo(rate)
    }, rate)
    console.log('Tremolo envelope', JSON.stringify(result))
    expect(result.frames).toBe(rate)
    expect(result.min).toBeCloseTo(0.35, 4)
    expect(result.max).toBeCloseTo(1, 4)
    expect(result.maxError).toBeLessThan(0.0001)
    expect(result.stereoError).toBeLessThan(0.00001)
    expect(result.zeroIsDry).toBe(true)
  }
})

// A 750 Hz square wave has constant magnitude, so taking abs exposes the gain envelope.
function envelope(samples: ArrayLike<number>, reference: number) {
  let min = Infinity,
    max = 0,
    first = -1,
    last = -1,
    crossings = 0
  for (let i = 0; i < samples.length; i++) {
    const gain = Math.abs(samples[i]) / reference
    min = Math.min(min, gain)
    max = Math.max(max, gain)
    if (i && gain >= 0.5 && Math.abs(samples[i - 1]) < 0.5 * reference) {
      if (!crossings) first = i
      last = i
      crossings++
    }
  }
  return { min, max, hz: crossings > 1 ? ((crossings - 1) * 48000) / (last - first) : 0 }
}
function liveSamples(page: Page) {
  return page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const meter = e.outputMeter!,
      data = new Float32Array(meter.fftSize)
    meter.getFloatTimeDomainData(data)
    return Array.from(data.subarray(-24000))
  })
}
function pcm(wav: Buffer) {
  const samples = new Int16Array((wav.length - 44) / 2)
  for (let i = 0; i < samples.length; i++) samples[i] = wav.readInt16LE(44 + 2 * i)
  return samples
}

test('페달 조절로 실시간·Wet WAV의 진폭 변조 주파수가 바뀌고 설정과 위치가 복원된다', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption('48000')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await expect(page.getByText('엔진 실행 중', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  await page.getByRole('button', { name: '오디오 파일', exact: true }).first().click()
  const square = audioWav(48000)
  for (let i = 0; i < 24000; i++) square.writeInt16LE(i % 64 < 32 ? 8000 : -8000, 44 + 2 * i)
  await page
    .getByLabel('오디오 파일 선택')
    .setInputFiles({ name: 'square.wav', mimeType: 'audio/wav', buffer: square })
  await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const settings = structuredClone(e.preset.settings)
    for (const mod of Object.values(settings)) mod.enabled = false
    e.setPreset({ ...e.preset, settings })
    e.outputMeter!.fftSize = 32768
  })
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  const dry = await downloadFile(page, 'Dry WAV')
  await expect
    .poll(async () => Math.min(...(await liveSamples(page)).map(Math.abs)))
    .toBeGreaterThan(0.0001)
  const reference = Math.max(...(await liveSamples(page)).map(Math.abs))
  await page.getByRole('link', { name: 'Virtual Rig', exact: true }).click()
  await page.getByRole('button', { name: 'Tremolo 파라미터 선택' }).click()
  const depth = page.getByRole('slider', { name: 'Depth', exact: true }),
    rate = page.getByRole('slider', { name: 'Rate', exact: true })
  await depth.press('End')
  await page.getByRole('button', { name: 'Tremolo 활성화', exact: true }).click()
  for (const hz of [4, 12]) {
    if (hz === 12) await rate.press('End')
    await expect
      .poll(async () => {
        const data = envelope(await liveSamples(page), reference)
        return [
          Math.round(data.hz * 10) / 10,
          Math.round(data.min * 100),
          Math.round(data.max * 100),
        ]
      })
      .toEqual([hz, 0, 100])
  }
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  const wet = await downloadFile(page, 'Wet WAV')
  expect(wet.length).toBe(dry.length)
  const measured = envelope(pcm(wet), Math.max(...pcm(dry)))
  expect(measured.hz).toBeCloseTo(12, 1)
  expect(measured.min).toBe(0)
  expect(measured.max).toBeCloseTo(1, 2)
  await depth.press('Home')
  expect((await downloadFile(page, 'Wet WAV')).equals(dry)).toBe(true)
  await depth.press('End')
  await page.getByRole('switch', { name: 'Tremolo 활성화' }).click()
  expect((await downloadFile(page, 'Wet WAV')).equals(dry)).toBe(true)
  await page.getByRole('switch', { name: 'Tremolo 활성화' }).click()
  await page.getByRole('button', { name: '순서 편집' }).click()
  await page.getByRole('button', { name: 'Tremolo 뒤로' }).click()
  await page.getByRole('button', { name: '닫기' }).click()
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('트레몰로 테스트')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('저장했습니다')
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption({ label: '트레몰로 테스트' })
  await page.getByLabel('선택한 이펙터').selectOption('tremolo')
  await expect(depth).toHaveValue('100')
  await expect(rate).toHaveValue('12')
  await expect(page.getByRole('switch', { name: 'Tremolo 활성화' })).toBeChecked()
  const route = await page
    .getByRole('list', { name: '현재 신호 순서' })
    .getByRole('listitem')
    .allTextContents()
  expect(route.indexOf('TRM')).toBe(route.indexOf('DLY') + 1)
})
