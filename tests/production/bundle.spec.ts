import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { downloadFile } from '../audio-wav'
test('빌드 번들에서 새로고침, WASM 및 Worklet 정적 자산 로딩', async ({ page }) => {
  const errors: string[] = [],
    assets: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('response', (r) => {
    if (r.ok() && /nam-(worklet|engine)-/.test(r.url())) assets.push(r.url())
  })
  await page.addInitScript(() => {
    const addModule = Worklet.prototype.addModule
    Worklet.prototype.addModule = async function (url, options) {
      await addModule.call(this, url, options)
      document.documentElement.dataset.loadedWorklet = String(url)
    }
  })
  await page.goto('/settings')
  await page.reload()
  await page.getByLabel('엔진 샘플레이트').selectOption('48000')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute(
    'data-loaded-worklet',
    /assets\/noise-gate\.worklet-[\w-]+\.js/,
  )
  await page.getByRole('switch', { name: 'Noise Gate 활성화' }).click()
  const beforeChorus = await downloadFile(page, 'Wet WAV')
  await page.getByRole('switch', { name: 'Chorus 활성화' }).click()
  const withChorus = await downloadFile(page, 'Wet WAV')
  expect(withChorus.length).toBeGreaterThan(beforeChorus.length)
  expect(withChorus.subarray(44, beforeChorus.length).equals(beforeChorus.subarray(44))).toBe(false)
  await page.getByRole('switch', { name: 'Tremolo 활성화' }).click()
  const withTremolo = await downloadFile(page, 'Wet WAV')
  expect(withTremolo.length).toBe(withChorus.length)
  expect(withTremolo.equals(withChorus)).toBe(false)
  const rate = Number(
    (
      await page.getByText('샘플레이트', { exact: true }).locator('..').locator('dd').innerText()
    ).split(' ')[0],
  )
  expect(rate).toBeGreaterThan(0)
  await page.getByText('NAM 모델', { exact: true }).click()
  await page.getByLabel('NAM 파일 선택').setInputFiles({
    name: 'built.nam',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: '0.5.4',
        architecture: 'Linear',
        config: { receptive_field: 1, bias: false },
        weights: [0.25],
        sample_rate: rate,
      }),
    ),
  })
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).toBeChecked()
  await page.getByRole('button', { name: 'NAM 모델 라이브러리' }).click()
  const models = page.getByRole('dialog', { name: 'NAM 모델 라이브러리' })
  await models
    .getByLabel('라이브러리에 모델 추가')
    .setInputFiles(resolve('assets/test-audio/riffsmith/riffsmith-distorted.nam'))
  await models.getByRole('button', { name: '모델 적용' }).click()
  await expect(models.getByRole('status')).toHaveText('선택한 모델을 연결했습니다.')
  await models.getByRole('button', { name: '닫기' }).click()
  await expect(page.getByLabel('캡처 유형')).toHaveValue('full')
  await expect(page.getByText('SlimmableContainer · 48,000 Hz')).toBeVisible()
  await page.getByRole('button', { name: '순서 편집' }).click()
  const editor = page.getByRole('dialog', { name: '이펙터 순서 편집' })
  await editor.getByRole('button', { name: 'NAM 모델 앞으로' }).click()
  await editor.getByRole('button', { name: '닫기' }).click()
  const route = page.getByRole('list', { name: '현재 신호 순서' }).getByRole('listitem')
  await expect(route.nth(4)).toHaveText('NAM')
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).toBeChecked()
  expect(assets.some((url) => url.endsWith('.wasm'))).toBe(true)
  await expect(page.locator('html')).toHaveAttribute(
    'data-loaded-worklet',
    /assets\/nam-worklet-.*\.js/,
  )
  expect(errors).toEqual([])
  await page.getByRole('button', { name: '엔진 중지', exact: true }).click()
  await expect(page.getByRole('button', { name: '엔진 시작', exact: true })).toBeVisible()
})
