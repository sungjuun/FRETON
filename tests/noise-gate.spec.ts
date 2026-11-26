import { expect, test, type Page } from '@playwright/test'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
import { audioWav, downloadFile } from './audio-wav'

test('스테레오 게이트가 잡음을 닫고 기타 음의 감쇠와 Hold·Release를 따른다', async ({ page }) => {
  await page.goto('/sandbox')
  for (const rate of [44100, 48000, 96000]) {
    const result = await page.evaluate(async (rate) => {
      const { checkGate }: typeof import('../apps/web/tests/noise-gate-check') = await import(
        /* @vite-ignore */ '/tests/noise-gate-check.ts' as string
      )
      return checkGate(rate)
    }, rate)
    expect(result.noise).toBe(0)
    expect(result.opening).toBeGreaterThan(0.1)
    expect(result.opening).toBeLessThan(0.5)
    for (const gain of [
      result.sustain,
      result.decay,
      result.hysteresisOpen,
      result.hold,
      result.linked,
    ])
      expect(gain).toBeCloseTo(1, 3)
    expect(result.releasing).toBeGreaterThan(0.7)
    expect(result.releasing).toBeLessThan(0.95)
    expect(result.lateRelease).toBeGreaterThan(0.2)
    expect(result.lateRelease).toBeLessThan(0.45)
    expect(result.closed).toBe(0)
    expect(result.hysteresisClosed).toBe(0)
    expect(result.oppositePhase).toBe(true)
    console.log('Noise Gate envelope', JSON.stringify(result))
  }
})

const wetWav = (page: Page) => downloadFile(page, 'Wet WAV')
async function meter(page: Page) {
  return page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const samples = new Float32Array(2048)
    e.outputMeter!.getFloatTimeDomainData(samples)
    return Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length)
  })
}

test('Noise Gate 페달·Threshold·바이패스가 라이브 출력과 내려받은 Wet WAV를 함께 바꾼다', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption('48000')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  await page.getByRole('button', { name: '오디오 파일', exact: true }).first().click()
  await page
    .getByLabel('오디오 파일 선택')
    .setInputFiles({ name: '750hz.wav', mimeType: 'audio/wav', buffer: audioWav(48000, 1, 750) })
  await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const settings = structuredClone(e.preset.settings)
    Object.values(settings).forEach((s) => (s.enabled = false))
    e.setPreset({ ...e.preset, settings })
  })
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  await expect.poll(() => meter(page)).toBeGreaterThan(0.001)
  const reference = await wetWav(page)
  await page.getByRole('link', { name: 'Virtual Rig', exact: true }).click()
  await page.getByRole('button', { name: 'Noise Gate 파라미터 선택' }).click()
  const threshold = page.getByRole('slider', { name: 'Threshold', exact: true })
  await threshold.press('End')
  await page.getByRole('switch', { name: '이펙터 활성화' }).click()
  await expect.poll(() => meter(page)).toBe(0)
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  const silent = await wetWav(page)
  expect(silent.length).toBe(reference.length)
  expect(silent.subarray(44).every((x) => x === 0)).toBe(true)
  await threshold.press('Home')
  await expect.poll(() => meter(page)).toBeGreaterThan(0.001)
  const loud = await wetWav(page)
  // Ignore the opening ramp; compare the steady portion as actual PCM16 samples.
  expect(loud.subarray(44 + 4096).equals(reference.subarray(44 + 4096))).toBe(true)
  await threshold.press('End')
  await page.getByRole('switch', { name: 'Noise Gate 활성화' }).click()
  await expect.poll(() => meter(page)).toBeGreaterThan(0.001)
  expect((await wetWav(page)).equals(reference)).toBe(true)
  await page.getByRole('switch', { name: 'Noise Gate 활성화' }).click()
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('게이트 테스트')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('저장했습니다')
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption({ label: '게이트 테스트' })
  await page.getByLabel('선택한 이펙터').selectOption('noiseGate')
  await expect(page.getByRole('switch', { name: 'Noise Gate 활성화' })).toBeChecked()
  await expect(threshold).toHaveValue('-10')
})

test('워크릿 로드 실패 시 실시간 게이트를 우회하고 활성 Wet 내보내기 실패를 알린다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const addModule = Worklet.prototype.addModule
    Worklet.prototype.addModule = function (url, options) {
      return String(url).includes('noise-gate.worklet')
        ? Promise.reject(Error('gate load failed'))
        : addModule.call(this, url, options)
    }
  })
  await page.goto('/sandbox')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('게이트를 우회')
  await page.getByRole('switch', { name: 'Noise Gate 활성화' }).click()
  await expect(page.getByText('Noise Gate가 바이패스 중입니다.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Wet WAV' }).click()
  await expect(page.getByRole('alert')).toContainText('Noise Gate 워크릿을 불러올 수 없습니다.')
  await page.getByRole('switch', { name: 'Noise Gate 활성화' }).click()
  expect((await wetWav(page)).length).toBeGreaterThan(44)
})
