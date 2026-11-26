import { expect, test, type Page } from '@playwright/test'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
import { audioWav, downloadFile } from './audio-wav'

test('Chorus의 LFO를 임펄스로 측정하고 스테레오, 마지막 음의 꼬리와 Mix 0을 검증한다', async ({
  page,
}) => {
  await page.goto('/sandbox')
  for (const rate of [44100, 48000, 96000]) {
    const result = await page.evaluate(async (rate) => {
      const { checkChorus }: typeof import('../apps/web/tests/chorus-check') = await import(
        /* @vite-ignore */ '/tests/chorus-check.ts' as string
      )
      return checkChorus(rate)
    }, rate)
    console.log('Chorus impulse', JSON.stringify(result))
    expect(result.minMs).toBeLessThan(10)
    expect(result.maxMs).toBeGreaterThan(20)
    expect(result.maxErrorMs).toBeLessThan(0.1)
    expect(result.dryGain).toBeCloseTo(0.65, 4)
    expect(result.stereo).toBe(true)
    expect(result.tailFrames).toBe(Math.ceil(0.021 * rate))
    expect(result.lastTap).toBeGreaterThan(0.05)
    expect(result.zeroMixMatchesDry).toBe(true)
  }
})

async function liveRms(page: Page) {
  return page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const samples = new Float32Array(2048)
    e.outputMeter!.getFloatTimeDomainData(samples)
    return Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length)
  })
}
function pcmPeak(wav: Buffer, startFrame: number, endFrame: number) {
  let peak = 0
  for (let i = startFrame; i < endFrame; i++)
    peak = Math.max(peak, Math.abs(wav.readInt16LE(44 + 2 * i)))
  return peak
}
test('Rig와 Sandbox에서 Chorus를 조절하고 실제 출력, WAV, 프리셋 복원을 확인한다', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption('48000')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await expect(page.getByText('엔진 실행 중', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  await page.getByRole('button', { name: '오디오 파일', exact: true }).first().click()
  await page
    .getByLabel('오디오 파일 선택')
    .setInputFiles({ name: '500hz.wav', mimeType: 'audio/wav', buffer: audioWav(48000, 1, 500) })
  await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const settings = structuredClone(e.preset.settings)
    for (const mod of Object.values(settings)) mod.enabled = false
    settings.chorus.values.mix = 50
    e.setPreset({ ...e.preset, settings })
  })
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  await expect.poll(() => liveRms(page)).toBeGreaterThan(0.001)
  const dry = await downloadFile(page, 'Dry WAV')
  await page.getByRole('link', { name: 'Virtual Rig', exact: true }).click()
  await page.getByRole('button', { name: 'Chorus 파라미터 선택' }).click()
  const depth = page.getByRole('slider', { name: 'Depth', exact: true })
  await depth.press('Home')
  await page.getByRole('button', { name: 'Chorus 활성화', exact: true }).click()
  // 15 ms equals 7.5 cycles at 500 Hz. At 50% mix the steady signals cancel.
  await expect.poll(() => liveRms(page)).toBeLessThan(0.00002)
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  const fixed = await downloadFile(page, 'Wet WAV')
  expect(pcmPeak(fixed, 4096, 16000)).toBeLessThanOrEqual(1)
  await depth.press('End')
  const rate = page.getByRole('slider', { name: 'Rate', exact: true })
  await rate.press('End')
  await expect.poll(() => liveRms(page)).toBeGreaterThan(0.0008)
  const modulated = await downloadFile(page, 'Wet WAV')
  expect(pcmPeak(modulated, 4096, 16000)).toBeGreaterThan(40)
  await page.getByRole('switch', { name: 'Chorus 활성화' }).click()
  expect((await downloadFile(page, 'Wet WAV')).equals(dry)).toBe(true)
  await page.getByRole('switch', { name: 'Chorus 활성화' }).click()
  await page.getByRole('button', { name: '순서 편집' }).click()
  await page.getByRole('button', { name: 'Chorus 뒤로' }).click()
  await page.getByRole('button', { name: '닫기' }).click()
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('코러스 테스트')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('저장했습니다')
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption({ label: '코러스 테스트' })
  await page.getByLabel('선택한 이펙터').selectOption('chorus')
  await expect(depth).toHaveValue('8')
  await expect(rate).toHaveValue('5')
  await expect(page.getByRole('switch', { name: 'Chorus 활성화' })).toBeChecked()
  const route = await page
    .getByRole('list', { name: '현재 신호 순서' })
    .getByRole('listitem')
    .allTextContents()
  expect(route.indexOf('CHO')).toBe(route.indexOf('TRM') + 1)
})
