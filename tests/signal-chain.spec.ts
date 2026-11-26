import { expect, test, type Page } from '@playwright/test'
import { defaultOrder, factoryPresets } from '../packages/audio-engine/src/presets/config'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
import { audioWav, downloadFile } from './audio-wav'

async function levels(page: Page) {
  const live = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    await new Promise((resolve) => setTimeout(resolve, 200))
    const samples = new Float32Array(2048)
    e.outputMeter!.getFloatTimeDomainData(samples)
    return Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length)
  })
  const wet = await downloadFile(page, 'Wet WAV')
  expect(wet.readUInt16LE(22)).toBe(1)
  let energy = 0
  for (let i = 4096; i < 6144; i++) energy += (wet.readInt16LE(44 + 2 * i) / 32768) ** 2
  return { live, wav: Math.sqrt(energy / 2048) }
}

test('재생 중 순서 변경과 복원이 실시간 신호와 Wet WAV에 동일하게 적용된다', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption('48000')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  await page.getByRole('button', { name: '오디오 파일', exact: true }).first().click()
  await page
    .getByLabel('오디오 파일 선택')
    .setInputFiles({ name: '750hz.wav', mimeType: 'audio/wav', buffer: audioWav(48000, 1, 750) })
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const p = structuredClone(e.preset)
    Object.values(p.settings).forEach((m) => (m.enabled = false))
    p.settings.eq.enabled = p.settings.distortion.enabled = true
    p.settings.eq.values.middle = 12
    p.settings.distortion.values.gain = 90
    e.setPreset(p)
    e.setLevel(0)
  })
  const before = await levels(page)
  const dry = await downloadFile(page, 'Dry WAV')
  await page.getByRole('button', { name: '순서 편집' }).click()
  const editor = page.getByRole('dialog', { name: '이펙터 순서 편집' })
  const row = (label: string) =>
    editor
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: label + ' 앞으로' }) })
  await row('Equalizer').dragTo(row('Distortion'))
  await expect(editor.getByRole('status')).toHaveText('Equalizer · 4번째')
  await editor.getByRole('button', { name: '닫기' }).click()
  const after = await levels(page)
  expect(before.live / after.live).toBeGreaterThan(2)
  expect(before.live / before.wav).toBeCloseTo(1, 2)
  expect(after.live / after.wav).toBeCloseTo(1, 2)
  expect(dry.equals(await downloadFile(page, 'Dry WAV'))).toBe(true)
  await page.getByRole('button', { name: '전체 Bypass' }).click()
  expect(dry.equals(await downloadFile(page, 'Wet WAV'))).toBe(true)
  await page.getByRole('button', { name: '전체 Bypass' }).click()
  // Queue edits in a single audio-clock fade, ending at the original topology.
  await page.evaluate(
    async (order) => {
      const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
      for (const next of [order, [...order].reverse(), order])
        e.setPreset({ ...e.preset, order: next })
    },
    [...defaultOrder],
  )
  const restored = await levels(page)
  expect(restored.live / before.live).toBeCloseTo(1, 2)
  expect(restored.wav).toBe(before.wav)
  console.log('Signal chain RMS', JSON.stringify({ before, after, restored }))
})

test('기존 IndexedDB 프리셋을 열고 순서를 키보드로 편집·저장·교환한다', async ({ page }) => {
  const legacy = {
    ...factoryPresets[2],
    order: undefined,
    version: 1,
    id: 'legacy-rig',
    name: '기존 리그',
  }
  await page.goto('/rig')
  await page.evaluate(async (p) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('freton-studio', 1)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('presets', 'readwrite')
        tx.objectStore('presets').put(JSON.parse(p))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }, JSON.stringify(legacy))
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption('legacy-rig')
  const route = page.getByRole('list', { name: '현재 신호 순서' }).getByRole('listitem')
  const expected = [
    'IN',
    'GATE',
    'COMP',
    'OD',
    'DIST',
    'NAM',
    'IR',
    'EQ',
    'CHO',
    'TRM',
    'DLY',
    'REV',
    'OUT',
  ]
  await expect(route).toHaveText(expected)
  await page.getByRole('button', { name: '순서 편집' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Noise Gate 앞으로' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Reverb 뒤로' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cabinet IR 앞으로' }).press('Enter')
  await dialog.getByRole('button', { name: '닫기' }).click()
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('저장했습니다')
  const json = await downloadFile(page, 'JSON 내보내기')
  const order = [...defaultOrder]
  order.splice(order.indexOf('nam'), 2, 'cabinet', 'nam')
  expect(JSON.parse(json.toString())).toMatchObject({
    version: 5,
    order,
    settings: legacy.settings,
  })
  await page.reload()
  await page.getByLabel('현재 프리셋', { exact: true }).selectOption('legacy-rig')
  expected.splice(expected.indexOf('NAM'), 2, 'IR', 'NAM')
  await expect(route).toHaveText(expected)
  await page.getByRole('button', { name: '프리셋 관리' }).click()
  await dialog
    .getByLabel('JSON 가져오기')
    .setInputFiles({ name: 'custom.json', mimeType: 'application/json', buffer: json })
  await expect(dialog.getByRole('status')).toContainText('가져온 프리셋')
  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(route).toHaveText(expected)
  await page.getByRole('button', { name: '순서 편집' }).click()
  await dialog.getByRole('button', { name: '기본 순서' }).click()
  await dialog.press('Escape')
  await expect(route.nth(5)).toHaveText('NAM')
})
