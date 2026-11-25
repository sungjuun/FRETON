import { expect, test } from '@playwright/test'
import { factoryPresets } from '../packages/audio-engine/src/presets/config'
test('프리셋 JSON 검증, 파일 재선택, 이름 변경, 복제, 삭제', async ({ page }) => {
  await page.goto('/rig')
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  const dialog = page.getByRole('dialog'),
    input = dialog.getByLabel('JSON 가져오기')
  await input.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  })
  await expect(dialog.getByText(/지원하지 않는 프리셋/)).toBeVisible()
  const p = {
    ...factoryPresets[2],
    version: 1,
    order: undefined,
    name: '가져온 톤',
    ir: { name: '없는-파일.wav', enabled: true },
  }
  await input.setInputFiles({
    name: 'preset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  })
  await expect(dialog.getByRole('textbox')).toHaveValue('가져온 톤')
  await dialog.getByRole('textbox').fill('새 이름')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByLabel('현재 프리셋').locator('option:checked')).toHaveText('새 이름')
  await dialog.getByRole('button', { name: '복제' }).click()
  await expect(dialog.getByRole('textbox')).toHaveValue('새 이름 복사본')
  const downloaded = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'JSON 내보내기' }).click()
  expect((await downloaded).suggestedFilename()).toBe('새 이름 복사본.json')
  await dialog.getByRole('button', { name: '삭제', exact: true }).click()
  await dialog.getByRole('button', { name: '삭제 확인' }).click()
  await expect(dialog.getByRole('textbox')).toHaveValue('Studio Clean')
  await dialog.getByRole('button', { name: '닫기' }).click()
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption({ label: '새 이름' })
  await expect(page.getByText('IR 파일을 다시 선택하세요 · 없는-파일.wav')).toBeVisible()
})
