import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { type AudioEngine } from '../packages/audio-engine/src'
import { downloadFile } from './audio-wav'

const capture = 'assets/test-audio/riffsmith/riffsmith-distorted.nam'
const captureHash = 'ec52e16296f96fdd1d07d1aaa699e33e17df253f026f785f135080e1eb5db007'
function linear(name: string, sampleRate: number) {
  return {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: '0.5.4',
        architecture: 'Linear',
        config: { receptive_field: 1, bias: false },
        weights: [0.25],
        sample_rate: sampleRate,
      }),
    ),
  }
}
async function openLibrary(page: Page) {
  const open = page.getByRole('button', { name: 'NAM 모델 라이브러리' })
  if (!(await open.isVisible())) await page.getByText('NAM 모델', { exact: true }).click()
  await open.click()
  return page.getByRole('dialog', { name: 'NAM 모델 라이브러리' })
}
async function configure(page: Page, rate: string) {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption(rate)
  await page.getByRole('link', { name: 'Virtual Rig', exact: true }).click()
}
test('NAM 라이브러리 중복 제거, 동명 모델 구분, 새 세션에서 프리셋 복원과 삭제', async ({
  page,
}) => {
  await configure(page, '48000')
  const dialog = await openLibrary(page)
  const input = dialog.getByLabel('라이브러리에 모델 추가')
  const select = dialog.getByLabel('저장한 NAM 모델')
  await expect(dialog.getByText('저장한 모델이 없습니다.')).toBeVisible()
  await input.setInputFiles(capture)
  await expect(select).toHaveValue(captureHash)
  await input.setInputFiles({
    name: 'renamed.nam',
    mimeType: 'application/json',
    buffer: await readFile(capture),
  })
  await expect(dialog.getByRole('status')).toHaveText(/이미 저장/)
  await expect(select.locator('option')).toHaveCount(1)
  await input.setInputFiles(linear('riffsmith-distorted.nam', 48000))
  await expect(select.locator('option')).toHaveCount(2)
  await expect(select).not.toHaveValue(captureHash)
  await select.selectOption(captureHash)
  await expect(dialog.getByRole('button', { name: '엔진 시작' })).toBeVisible()
  await dialog.getByRole('button', { name: '엔진 시작' }).click()
  await dialog.getByRole('button', { name: '모델 적용' }).click()
  await expect(dialog.getByRole('status')).toHaveText('선택한 모델을 연결했습니다.')
  await dialog.getByRole('button', { name: '닫기' }).click()
  await page.getByRole('switch', { name: 'NAM 활성화' }).click()
  await page.getByLabel('캡처 유형').selectOption('amp')
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  const presets = page.getByRole('dialog', { name: '프리셋 관리' })
  await presets.getByRole('textbox').fill('나의 캡처')
  await presets.getByRole('button', { name: '저장', exact: true }).click()
  await expect(presets.getByRole('status')).toHaveText(/저장했습니다/)
  const exported = JSON.parse((await downloadFile(page, 'JSON 내보내기')).toString())
  expect(exported.nam).toEqual({
    name: 'riffsmith-distorted.nam',
    sha256: captureHash,
    enabled: false,
    capture: 'amp',
  })
  await configure(page, '48000')
  await page.getByLabel('현재 프리셋').selectOption({ label: '나의 캡처' })
  await openLibrary(page)
  await expect(select).toHaveValue(captureHash)
  await dialog.getByRole('button', { name: '엔진 시작' }).click()
  await dialog.getByRole('button', { name: '모델 적용' }).click()
  await expect(dialog.getByRole('status')).toContainText('연결했습니다')
  await dialog.getByRole('button', { name: '목록에서 삭제' }).click()
  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(select.locator('option')).toHaveCount(2)
  await dialog.getByRole('button', { name: '목록에서 삭제' }).click()
  await dialog.getByRole('button', { name: '삭제 확인' }).click()
  await expect(select.locator('option')).toHaveCount(1)
  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(page.getByText('SlimmableContainer · 48,000 Hz')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).not.toBeChecked()
  await expect(page.getByLabel('캡처 유형')).toHaveValue('amp')
  await page.reload()
  await page.getByLabel('현재 프리셋').selectOption({ label: '나의 캡처' })
  await openLibrary(page)
  await expect(dialog.getByText(/원본이 목록에 없습니다/)).toBeVisible()
  await expect(select).toHaveValue('')
  await expect(select.locator('option:enabled')).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: '모델 적용' })).toHaveCount(0)
})

test('NAM 라이브러리 입력 오류, 레이트 불일치와 읽는 중 프리셋 전환에서 기존 모델 보존', async ({
  page,
}) => {
  await configure(page, '44100')
  const dialog = await openLibrary(page)
  const input = dialog.getByLabel('라이브러리에 모델 추가')
  await input.setInputFiles({
    name: 'bad.nam',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(dialog.getByRole('alert')).toHaveText(/JSON 형식/)
  await expect(dialog.getByText('저장한 모델이 없습니다.')).toBeVisible()
  await input.setInputFiles(linear('current.nam', 44100))
  await dialog.getByRole('button', { name: '엔진 시작' }).click()
  await dialog.getByRole('button', { name: '모델 적용' }).click()
  await expect(dialog.getByRole('status')).toContainText('연결했습니다')
  await input.setInputFiles(capture)
  await expect(dialog.getByText(/모델은 48,000 Hz, 현재 엔진은 44,100 Hz/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: '모델 적용' })).toBeDisabled()
  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(page.getByText('Linear · 44,100 Hz')).toBeVisible()
  const result = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    let started!: () => void, release!: () => void
    const read = new Promise<void>((r) => (started = r))
    const gate = new Promise<void>((r) => (release = r))
    const previousHash = e.namInfo!.sha256
    const pending = e.loadNam({
      name: 'late.nam',
      sha256: '0'.repeat(64),
      readFile: async () => {
        started()
        await gate
        return new File(['invalid'], 'late.nam')
      },
    })
    await read
    e.setPreset({ ...e.preset, id: 'other-preset' })
    release()
    await pending
    return e.assetReady('nam') && e.namInfo?.sha256 === previousHash && !e.namBusy
  })
  expect(result).toBe(true)
})
