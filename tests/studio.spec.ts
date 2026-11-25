import { audioWav } from './audio-wav'
import { test, expect, type Page } from '@playwright/test'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
const start = async (page: Page) => {
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await expect(page.getByText('엔진 실행 중', { exact: true })).toBeVisible()
}
test('Virtual Rig 탐색, 노브, 페달, 프리셋 저장 및 새로고침', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Virtual Rig' })).toBeVisible()
  await expect(page.getByRole('button', { name: '엔진 시작', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/virtual-rig.png', fullPage: true })
  await page.getByRole('link', { name: 'Practice Room' }).click()
  await expect(page.getByRole('heading', { name: '개발 예정' })).toBeVisible()
  await page.getByRole('link', { name: 'Virtual Rig', exact: true }).click()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption('indie-drive')
  const bass = page.getByRole('slider', { name: 'Bass', exact: true })
  await bass.focus()
  await bass.press('ArrowUp')
  await expect(bass).toHaveAttribute('aria-valuenow', '0.5')
  await bass.press('Delete')
  await expect(bass).toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: 'Delay 파라미터 선택' }).click()
  await expect(page.getByRole('slider', { name: 'Feedback', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  await page.getByRole('textbox', { name: '프리셋 이름' }).fill('나의 테스트 톤')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '브라우저에 저장' })).toBeVisible()
  await page.getByRole('button', { name: '즐겨찾기' }).click()
  await expect(page.getByRole('button', { name: '즐겨찾기' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption({ label: '★ 나의 테스트 톤' })
  await expect(page.locator('.rig-hw-preset')).toHaveText('나의 테스트 톤')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('slider', { name: 'Master', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
test('입력 전환, 실제 미터, 로컬 파일 재생·탐색·반복 및 WAV 출력', async ({ page }) => {
  await page.goto('/sandbox')
  await start(page)
  await page.getByRole('button', { name: '테스트 신호', exact: true }).first().click()
  await page.getByLabel('테스트 파형').selectOption('square')
  await expect
    .poll(() => page.locator('.scope').first().locator('.meter-read').textContent())
    .not.toContain('−∞')
  await page.getByRole('button', { name: '파형 · 스펙트럼 보기' }).first().click()
  await expect(page.getByLabel('입력 스펙트럼')).toBeVisible()
  await page.getByRole('button', { name: '오디오 파일', exact: true }).first().click()
  await page
    .getByLabel('오디오 파일 선택')
    .setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: audioWav() })
  await expect(page.getByText('test.wav', { exact: true })).toBeVisible()
  const drop = await page.evaluateHandle(
    (bytes) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([Uint8Array.from(bytes)], 'dropped.wav', { type: 'audio/wav' }))
      return transfer
    },
    [...audioWav(16000)],
  )
  await page.locator('.filebox').dispatchEvent('drop', { dataTransfer: drop })
  await drop.dispose()
  await expect(page.getByText('dropped.wav', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
  await page.getByRole('button', { name: '일시정지' }).click()
  await page.getByRole('slider', { name: '재생 위치' }).focus()
  await page.getByRole('slider', { name: '재생 위치' }).press('End')
  await expect(page.getByRole('slider', { name: '재생 위치' })).toHaveValue('0.5')
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  await page.getByRole('slider', { name: '재생 위치' }).press('End')
  await expect(page.getByRole('button', { name: '파일 재생' })).toBeVisible()
  await expect(page.getByRole('slider', { name: '재생 위치' })).toHaveValue('0.5')
  await page.getByRole('button', { name: '파일 정지' }).click()
  for (const label of ['Dry WAV', 'Wet WAV']) {
    const promise = page.waitForEvent('download')
    await page.getByRole('button', { name: label }).click()
    expect((await promise).suggestedFilename()).toMatch(/\.wav$/)
  }
  await page.getByRole('button', { name: '엔진 중지' }).click()
  await expect(page.getByRole('button', { name: '엔진 시작' })).toBeVisible()
  await start(page)
  await expect(page.getByRole('button', { name: '파일 재생' })).toBeEnabled()
})
test('장치 없음 및 권한 거부가 다른 입력 소스를 막지 않는다 (API 대역)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [] })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        throw new DOMException('Permission denied', 'NotAllowedError')
      },
    })
  })
  await page.goto('/sandbox')
  await start(page)
  await page.getByRole('button', { name: '라이브 입력', exact: true }).first().click()
  await page.getByRole('button', { name: '입력 연결' }).click()
  await expect(page.getByRole('alert')).toContainText(/denied|거부/)
  await page.getByRole('button', { name: '합성 기타', exact: true }).first().click()
  await expect
    .poll(() => page.locator('.scope').first().locator('.meter-read').textContent())
    .not.toContain('−∞')
})
test('실제 NAM Worklet 처리와 교체, 독립적인 IR 및 예외 복구', async ({ page }) => {
  await page.goto('/rig')
  await start(page)
  await page.getByText('NAM 모델', { exact: true }).click()
  const rate = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    e.selectSource('test')
    e.setSignal('sine', 300)
    const settings = structuredClone(e.preset.settings)
    Object.values(settings).forEach((m) => (m.enabled = false))
    e.setPreset({ ...e.preset, settings })
    return e.ctx!.sampleRate
  })
  const file = (weight: number, rateOverride = rate) => ({
    name: 'linear-' + weight + '.nam',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: '0.5.4',
        architecture: 'Linear',
        config: { receptive_field: 1, bias: false },
        metadata: {},
        weights: [weight],
        sample_rate: rateOverride,
      }),
    ),
  })
  const rms = () =>
    page.evaluate(async () => {
      const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
      const a = new Float32Array(2048)
      await new Promise((r) => setTimeout(r, 250))
      e.outputMeter!.getFloatTimeDomainData(a)
      return Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length)
    })
  const dry = await rms()
  await page.getByLabel('NAM 파일 선택').setInputFiles(file(0.25))
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).toBeChecked()
  const quarter = await rms()
  expect(quarter / dry).toBeCloseTo(0.25, 1)
  await page.getByLabel('NAM 파일 선택').setInputFiles(file(0.5))
  await expect(page.locator('summary').filter({ hasText: 'linear-0.5.nam' })).toBeVisible()
  expect((await rms()) / quarter).toBeCloseTo(2, 1)
  await page.getByLabel('NAM 파일 선택').setInputFiles(file(0.8, rate + 1000))
  await expect(page.getByRole('alert')).toContainText('샘플레이트')
  await page.getByRole('switch', { name: 'NAM 활성화' }).click()
  expect((await rms()) / dry).toBeCloseTo(1, 1)
  await page.getByText('Cabinet IR', { exact: true }).click()
  await page
    .getByLabel('IR WAV 선택')
    .setInputFiles({ name: 'stereo-ir.wav', mimeType: 'audio/wav', buffer: audioWav(32000, 2) })
  await expect(page.getByRole('switch', { name: 'IR 활성화' })).toBeChecked()
  await expect(page.getByText(/2 ch · 32000 →/)).toBeVisible()
  await page
    .getByLabel('IR WAV 선택')
    .setInputFiles({ name: 'bad.wav', mimeType: 'audio/wav', buffer: Buffer.from('bad') })
  await expect(page.getByRole('alert')).toContainText('RIFF WAV')
  await page.getByRole('button', { name: '파일 해제' }).first().click()
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).toHaveCount(0)
  await page.getByRole('button', { name: '엔진 중지' }).click()
  await expect(page.getByRole('button', { name: '엔진 시작' })).toBeVisible()
})
