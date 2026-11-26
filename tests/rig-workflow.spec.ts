import { createHash } from 'node:crypto'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { factoryPresets } from '../packages/audio-engine/src/presets/config'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
import { audioWav } from './audio-wav'

async function tabTo(page: Page, control: Locator) {
  await expect(control).toBeVisible()
  for (let i = 0; i < 90; i++) {
    if (await control.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw Error('Tab 키로 도달할 수 없는 컨트롤 · ' + control)
}
async function activate(page: Page, control: Locator) {
  await expect(control).toBeEnabled()
  await tabTo(page, control)
  await page.keyboard.press('Enter')
}
async function pick(page: Page, input: Locator, name: string, buffer: Buffer, mimeType: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), activate(page, input)])
  await chooser.setFiles({ name, buffer, mimeType })
}
async function outputRms(page: Page) {
  return page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const samples = new Float32Array(e.outputMeter!.fftSize)
    e.outputMeter!.getFloatTimeDomainData(samples)
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
  })
}

test('Virtual Rig에서 키보드로 입력·프리셋·NAM을 전환하고 표시된 경로와 출력을 비교한다', async ({
  page,
}) => {
  await page.goto('/rig')
  const path = page.getByRole('status', { name: '앰프 신호 경로' })
  await expect(path).toHaveText('엔진 대기')
  const inputButton = page.locator('main').getByRole('button', { name: /^입력 설정/ })
  await activate(page, inputButton)
  const dialog = page.getByRole('dialog', { name: '오디오 입력' })
  await activate(page, dialog.getByRole('button', { name: '오디오 파일', exact: true }))
  await expect(dialog.getByLabel('오디오 파일 선택')).toBeDisabled()
  await activate(page, dialog.getByRole('button', { name: '엔진 시작' }))
  await pick(
    page,
    dialog.getByLabel('오디오 파일 선택'),
    '기준음.wav',
    audioWav(48000, 1, 750),
    'audio/wav',
  )
  await activate(page, dialog.getByRole('button', { name: '반복 재생' }))
  await activate(page, dialog.getByRole('button', { name: '파일 재생' }))
  await page.keyboard.press('Escape')
  await expect(inputButton).toBeFocused()
  await expect(inputButton).toHaveAccessibleName('입력 설정 · 오디오 파일')

  const rate = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    return e.ctx!.sampleRate
  })
  const linear = (gain: number) =>
    Buffer.from(
      JSON.stringify({
        version: '0.5.4',
        architecture: 'Linear',
        config: { receptive_field: 1, bias: false },
        sample_rate: rate,
        weights: [gain],
      }),
    )
  const model = linear(0.25)
  const preset = structuredClone(factoryPresets[0])
  for (const effect of Object.values(preset.settings)) effect.enabled = false
  preset.name = '모델 전환 검사'
  const quarterHash = createHash('sha256').update(model).digest('hex')
  preset.nam = { name: 'quarter.nam', sha256: quarterHash, enabled: true }
  const presetsButton = page.getByRole('button', { name: '프리셋 관리' })
  await activate(page, presetsButton)
  const presets = page.getByRole('dialog', { name: '프리셋 관리' })
  await pick(
    page,
    presets.getByLabel('JSON 가져오기'),
    'rig.json',
    Buffer.from(JSON.stringify(preset)),
    'application/json',
  )
  await expect(presets.getByRole('textbox')).toHaveValue(preset.name)
  await activate(page, presets.getByRole('button', { name: '닫기' }))
  await expect(presetsButton).toBeFocused()
  await expect(path).toHaveText('기본 DSP · NAM 미연결')

  const dryButton = page.getByRole('button', { name: 'A · DRY' })
  const wetButton = page.getByRole('button', { name: 'B · WET' })
  await activate(page, dryButton)
  await expect(path).toHaveText('원음 · Dry')
  await expect.poll(() => outputRms(page)).toBeGreaterThan(0.0001)
  const dry = await outputRms(page)
  const ratio = () => expect.poll(async () => (await outputRms(page)) / dry)
  await activate(page, wetButton)
  await ratio().toBeCloseTo(1, 1)

  await activate(page, page.getByRole('link', { name: '모델 라이브러리로 이동' }))
  const libraryButton = page.getByRole('button', { name: 'NAM 모델 라이브러리' })
  await expect(libraryButton).toBeFocused()
  await page.keyboard.press('Enter')
  const library = page.getByRole('dialog', { name: 'NAM 모델 라이브러리' })
  await pick(
    page,
    library.getByLabel('라이브러리에 모델 추가'),
    'quarter.nam',
    model,
    'application/json',
  )
  await activate(page, library.getByRole('button', { name: '모델 적용' }))
  await expect(library.getByRole('status')).toContainText('연결했습니다')
  await expect(library.getByRole('button', { name: '모델 적용' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(libraryButton).toBeFocused()
  await expect(path).toHaveText('NAM · quarter.nam')
  await ratio().toBeCloseTo(0.25, 1)
  await activate(page, dryButton)
  await expect(path).toHaveText('원음 · Dry')
  await ratio().toBeCloseTo(1, 1)
  await activate(page, wetButton)
  const bypass = page.getByRole('button', { name: '전체 Bypass' })
  await activate(page, bypass)
  await expect(path).toHaveText('원음 · 전체 Bypass')
  await ratio().toBeCloseTo(1, 1)
  await page.keyboard.press('Space')
  await ratio().toBeCloseTo(0.25, 1)

  await activate(page, libraryButton)
  await pick(
    page,
    library.getByLabel('라이브러리에 모델 추가'),
    'half.nam',
    linear(0.5),
    'application/json',
  )
  await activate(page, library.getByRole('button', { name: '모델 적용' }))
  await expect(library.getByRole('status')).toContainText('연결했습니다')
  await page.keyboard.press('Escape')
  await expect(path).toHaveText('NAM · half.nam')
  await ratio().toBeCloseTo(0.5, 1)

  const select = page.getByLabel('현재 프리셋', { exact: true })
  await tabTo(page, select)
  await page.keyboard.press('Home')
  await expect(page.locator('.rig-hw-preset')).toHaveText('Studio Clean')
  await expect(path).toHaveText('기본 DSP')
  await page.keyboard.press('End')
  await expect(page.locator('.rig-hw-preset')).toHaveText(preset.name)
  await expect(path).toHaveText('기본 DSP · NAM 미연결')
  await ratio().toBeCloseTo(1, 1)
  await activate(page, page.getByRole('link', { name: '모델 라이브러리로 이동' }))
  await expect(libraryButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(library.getByLabel('저장한 NAM 모델')).toHaveValue(quarterHash)
  await activate(page, library.getByRole('button', { name: '모델 적용' }))
  await expect(library.getByRole('status')).toContainText('연결했습니다')
  await page.keyboard.press('Escape')
  await expect(path).toHaveText('NAM · quarter.nam')
  await ratio().toBeCloseTo(0.25, 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(path).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('라이브 입력 권한 대기 중 취소·입력 전환·재시도를 키보드로 처리한다 (장치 API 대역)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pending: Array<() => void> = []
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () =>
        new Promise<MediaStream>((_, reject) => {
          pending.push(() => reject(new DOMException('denied', 'NotAllowedError')))
        }),
    })
    window.addEventListener('deny-oldest-input', () => pending.shift()?.())
  })
  const deny = () => page.evaluate(() => window.dispatchEvent(new Event('deny-oldest-input')))
  await page.goto('/rig')
  await activate(page, page.getByRole('button', { name: '엔진 시작' }))
  const open = page.locator('main').getByRole('button', { name: /^입력 설정/ })
  await activate(page, open)
  const dialog = page.getByRole('dialog', { name: '오디오 입력' })
  const live = dialog.getByRole('button', { name: '라이브 입력', exact: true })
  const connect = dialog.getByRole('button', { name: '입력 연결', exact: true })
  const cancel = dialog.getByRole('button', { name: '연결 요청 취소' })
  await activate(page, live)
  await activate(page, connect)
  await expect(dialog.getByRole('status').filter({ hasText: '장치 응답' })).toBeVisible()
  await activate(page, cancel)
  await activate(page, connect)
  await deny()
  await expect(cancel).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await activate(page, dialog.getByRole('button', { name: '테스트 신호', exact: true }))
  await deny()
  await expect.poll(() => outputRms(page)).toBeGreaterThan(0.0001)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await activate(page, live)
  await activate(page, connect)
  await deny()
  await expect(dialog.getByRole('alert')).toContainText('입력 권한이 거부')
  await expect(connect).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(open).toBeFocused()
  await activate(page, page.getByRole('button', { name: '오류 닫기' }))
  await activate(page, open)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await activate(page, connect)
  await deny()
  await expect(dialog.getByRole('alert')).toContainText('입력 권한이 거부')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alert')).toContainText('입력 권한이 거부')
})
