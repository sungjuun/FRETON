import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
import { audioWav } from './audio-wav'

const capture = resolve('assets/test-audio/riffsmith/riffsmith-distorted.nam')
const captureHash = 'ec52e16296f96fdd1d07d1aaa699e33e17df253f026f785f135080e1eb5db007'

// At 48 kHz this window spans exactly 32 periods of the test file's 750 Hz sine.
async function measure(page: Page) {
  return page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const samples = new Float32Array(2048)
    await new Promise((r) => setTimeout(r, 240))
    e.outputMeter!.getFloatTimeDomainData(samples)
    function amplitude(multiple: number) {
      let real = 0,
        imaginary = 0
      samples.forEach((v, i) => {
        const phase = (2 * Math.PI * 750 * multiple * i) / 48000
        real += v * Math.cos(phase)
        imaginary += v * Math.sin(phase)
      })
      return Math.hypot(real, imaginary)
    }
    return {
      rms: Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length),
      third: amplitude(3) / amplitude(1),
    }
  })
}

test('48 kHz 실캡처에서 파일 입력의 고조파, 레이트 불일치, 원음 복귀와 원본 재연결', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption('44100')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await page.getByRole('link', { name: 'Virtual Rig', exact: true }).click()
  await page.getByText('NAM 모델', { exact: true }).click()
  await page.getByLabel('NAM 파일 선택').setInputFiles(capture)
  await expect(page.getByRole('alert')).toContainText('48000 Hz / 현재 엔진 44100 Hz')
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByLabel('엔진 샘플레이트').selectOption('48000')
  await page.getByRole('button', { name: '오디오 엔진 재시작' }).click()
  await expect(page.getByText('48000 Hz', { exact: true })).toBeVisible()
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
    Object.values(p.settings).forEach((mod) => (mod.enabled = false))
    e.setPreset(p)
    e.setLevel(0)
  })
  const dry = await measure(page)
  await page.getByText('NAM 모델', { exact: true }).click()
  await page.getByLabel('NAM 파일 선택').setInputFiles(capture)
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).toBeChecked()
  await expect(page.getByLabel('캡처 유형')).toHaveValue('full')
  await expect(page.getByText('SlimmableContainer · 48,000 Hz')).toBeVisible()
  const wet = await measure(page)
  expect(wet.rms).toBeGreaterThan(0.0001)
  expect(dry.third).toBeLessThan(0.001)
  expect(wet.third).toBeGreaterThan(0.01)
  await page.getByRole('switch', { name: 'NAM 활성화' }).click()
  const bypass = await measure(page)
  expect(bypass.rms / dry.rms).toBeCloseTo(1, 2)
  expect(bypass.third).toBeLessThan(0.001)
  console.log('RiffSmith Distorted', JSON.stringify({ dry, wet, bypass }))
  await page.getByLabel('캡처 유형').selectOption('unknown')
  await page.getByRole('button', { name: '엔진 중지', exact: true }).click()
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await page.getByLabel('NAM 원본 다시 연결').setInputFiles({
    name: 'riffsmith-distorted.nam',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        sample_rate: 48000,
        version: '0.5.4',
        architecture: 'Linear',
        weights: [0.5],
        config: { bias: false, receptive_field: 1 },
      }),
    ),
  })
  await expect(page.getByRole('alert')).toContainText('저장된 파일과 일치하지 않습니다')
  await page.getByLabel('NAM 원본 다시 연결').setInputFiles(capture)
  await expect(page.getByText('SlimmableContainer · 48,000 Hz')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'NAM 활성화' })).not.toBeChecked()
  await expect(page.getByLabel('캡처 유형')).toHaveValue('unknown')
  const hash = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    return e.preset.nam?.sha256
  })
  expect(hash).toBe(captureHash)
  // Only the local read is delayed. Both candidates go through the real NAM engine.
  const afterSwitch = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const bytes = JSON.stringify({
      version: '0.5.4',
      architecture: 'Linear',
      config: { receptive_field: 1, bias: false },
      sample_rate: 48000,
      weights: [0.25],
    })
    const file = new File([bytes], 'late.nam')
    let reading!: () => void, release!: () => void
    const started = new Promise<void>((r) => (reading = r)),
      gate = new Promise<void>((r) => (release = r))
    file.arrayBuffer = async () => {
      reading()
      await gate
      return new TextEncoder().encode(bytes).buffer
    }
    const pending = e.loadNam(file)
    await started
    e.setPreset({ ...e.preset, id: 'another-preset', name: '다른 프리셋' })
    release()
    await pending
    return { ready: e.assetReady('nam'), sha256: e.namInfo?.sha256, loading: e.namBusy }
  })
  expect(afterSwitch).toEqual({ ready: true, sha256: captureHash, loading: false })
})

test('IR 원본 재연결은 지문과 바이패스를 보존하고 교체는 새 파일을 적용한다', async ({ page }) => {
  await page.goto('/rig')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await page.getByText('Cabinet IR', { exact: true }).click()
  const file = { name: 'cab.wav', mimeType: 'audio/wav', buffer: audioWav(32000) }
  await page.getByLabel('IR WAV 선택').setInputFiles(file)
  await expect(page.getByRole('switch', { name: 'IR 활성화' })).toBeChecked()
  await page.getByRole('switch', { name: 'IR 활성화' }).click()
  await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const saved = e.preset
    e.removeIR()
    e.setPreset(saved)
  })
  const other = { ...file, buffer: audioWav(44100) }
  await page.getByLabel('IR 원본 다시 연결').setInputFiles(other)
  await expect(page.getByRole('alert')).toContainText('저장된 파일과 일치하지 않습니다')
  await page.getByLabel('IR 원본 다시 연결').setInputFiles({ ...file, name: 'renamed.wav' })
  await expect(page.locator('summary').filter({ hasText: 'renamed.wav' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'IR 활성화' })).not.toBeChecked()
  await page.getByLabel('IR WAV 선택').setInputFiles(other)
  await expect(page.getByRole('switch', { name: 'IR 활성화' })).toBeChecked()
  await expect(page.getByText(/1 ch · 44100 →/)).toBeVisible()
})
