import { expect, test, type Browser, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { audioWav } from '../audio-wav'

const capturePath = 'assets/test-audio/riffsmith/riffsmith-distorted.nam'
const captureHash = 'ec52e16296f96fdd1d07d1aaa699e33e17df253f026f785f135080e1eb5db007'
const sampleRates = [44100, 48000, 96000]
const warmupMs = 1000
const windowMs = 2000
const rounds = 3
const input = audioWav(48000, 1, 750)
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
type Condition = 'no-model' | 'Linear' | 'RiffSmith'
type Measurement = {
  round: number
  condition: Condition
  beforeDb: number
  afterDb: number
  frames: number
  durationsUs: number[]
}

type TraceEvent = {
  name: string
  ph: string
  dur?: number
  args?: { frames?: number }
}

async function captureBlocks(browser: Browser, sampleRate: number) {
  await browser.startTracing(undefined, { categories: ['-*', 'webaudio'] })
  let bytes: Buffer
  try {
    await delay(windowMs)
  } finally {
    bytes = await browser.stopTracing()
  }
  const events: TraceEvent[] = JSON.parse(bytes.toString()).traceEvents
  const blocks = events.filter(
    (event) => event.ph === 'X' && event.name === 'RealtimeAudioDestinationHandler::Render',
  )
  const frames = blocks[0]?.args?.frames
  if (!frames || !Number.isSafeInteger(frames) || frames < 1)
    throw Error('Chrome trace에 오디오 렌더 블록 또는 프레임 수가 없습니다.')
  const durationsUs = blocks.map(({ args, dur }) => {
    if (args?.frames !== frames || typeof dur !== 'number' || !Number.isFinite(dur) || dur < 0)
      throw Error('렌더 블록 크기 또는 경과 시간을 확인할 수 없습니다.')
    return dur
  })
  // Require enough rendered audio to cover the observation window.
  expect((durationsUs.length * frames) / sampleRate).toBeGreaterThan((windowMs / 1000) * 0.8)
  return { frames, durationsUs }
}

function summarize(durationsUs: number[], frames: number, sampleRate: number) {
  const sorted = [...durationsUs].sort((a, b) => a - b)
  const medianUs =
    (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2
  const p95Us = sorted[Math.ceil(sorted.length * 0.95) - 1]
  return {
    blocks: sorted.length,
    medianUs,
    p95Us,
    p95BudgetPercent: ((p95Us * sampleRate) / (frames * 1e6)) * 100,
  }
}

async function startPlayback(page: Page, rate: number) {
  await page.goto('/settings')
  await page.getByLabel('엔진 샘플레이트').selectOption(String(rate))
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await expect(page.getByText(rate + ' Hz', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Audio Sandbox', exact: true }).click()
  const effects = page.locator('.fx-list')
  await expect(effects).toBeVisible()
  for (const toggle of await effects.getByRole('switch').all()) {
    if (await toggle.isChecked()) await toggle.click()
  }
  await expect(effects.getByRole('switch', { checked: true })).toHaveCount(0)
  await page.getByRole('button', { name: '오디오 파일', exact: true }).click()
  await page.getByLabel('오디오 파일 선택').setInputFiles({
    name: '750hz.wav',
    mimeType: 'audio/wav',
    buffer: input,
  })
  await page.getByRole('slider', { name: '입력 레벨' }).press('End')
  await expect(page.getByRole('slider', { name: '입력 레벨' })).toHaveValue('0')
  await expect(page.getByRole('slider', { name: 'Master' })).toHaveValue('-24')
  await page.getByRole('button', { name: '반복 재생' }).click()
  await page.getByRole('button', { name: '파일 재생' }).click()
  await page.getByText('NAM 모델', { exact: true }).click()
}

async function rmsDb(page: Page) {
  const text = await page
    .locator('.scope')
    .filter({ hasText: 'OUTPUT' })
    .locator('.meter-read')
    .innerText()
  const value = /^RMS (-?\d+\.\d+)/.exec(text)
  if (!value) throw Error('출력 RMS를 측정할 수 없습니다 · ' + text)
  return Number(value[1])
}

for (const rate of sampleRates) {
  test('NAM 렌더 부하 · ' + rate + ' Hz', async ({ page, browser }, info) => {
    const startedAt = new Date().toISOString()
    const capture = await readFile(capturePath)
    expect(sha256(capture)).toBe(captureHash)
    const captureRate: number = JSON.parse(capture.toString()).sample_rate
    const linear = Buffer.from(
      JSON.stringify({
        version: '0.5.4',
        architecture: 'Linear',
        config: { receptive_field: 1, bias: false },
        weights: [0.25],
        sample_rate: rate,
      }),
    )
    const conditions: Condition[] = ['no-model', 'Linear']
    if (rate === captureRate) conditions.push('RiffSmith')
    await startPlayback(page, rate)
    const rack = page
      .locator('details')
      .filter({ has: page.getByText('NAM 모델', { exact: true }) })
    const pick = rack.getByLabel('NAM 파일 선택')
    const toggle = rack.getByRole('switch', { name: 'NAM 활성화' })
    const unload = rack.getByRole('button', { name: '파일 해제' })
    if (rate !== captureRate) {
      await pick.setInputFiles(capturePath)
      await expect(page.getByRole('alert')).toContainText(
        `NAM ${captureRate} Hz / 현재 엔진 ${rate} Hz`,
      )
      await expect(toggle).toHaveCount(0)
      await page.getByRole('button', { name: '오류 닫기' }).click()
    }
    const measurements: Measurement[] = []
    for (let round = 0; round < rounds; round++) {
      for (let index = 0; index < conditions.length; index++) {
        const condition = conditions[(round + index) % conditions.length]
        if (await unload.isVisible()) {
          await unload.click()
          await expect(toggle).toHaveCount(0)
        }
        if (condition !== 'no-model') {
          const file =
            condition === 'Linear'
              ? { name: 'linear.nam', mimeType: 'application/json', buffer: linear }
              : capturePath
          await pick.setInputFiles(file)
          await expect(toggle).toBeChecked()
        }
        await delay(warmupMs)
        const beforeDb = await rmsDb(page)
        const { frames, durationsUs } = await captureBlocks(browser, rate)
        const afterDb = await rmsDb(page)
        await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
        await expect(page.getByRole('alert')).toHaveCount(0)
        if (condition !== 'no-model') await expect(toggle).toBeChecked()
        measurements.push({ round: round + 1, condition, beforeDb, afterDb, frames, durationsUs })
      }
    }
    await page.getByRole('button', { name: '엔진 중지', exact: true }).click()
    await expect(page.getByRole('button', { name: '엔진 시작', exact: true })).toBeVisible()
    const summary = conditions.map((condition) => {
      const runs = measurements.filter((entry) => entry.condition === condition)
      const frames = runs[0].frames
      expect(runs.every((entry) => entry.frames === frames)).toBe(true)
      return {
        condition,
        frames,
        ...summarize(
          runs.flatMap((entry) => entry.durationsUs),
          frames,
          rate,
        ),
      }
    })
    const base = measurements.find((entry) => entry.condition === 'no-model')!
    for (const run of measurements.filter((entry) => entry.condition === 'Linear')) {
      for (const db of [run.beforeDb, run.afterDb])
        expect(Math.abs(db - base.beforeDb - 20 * Math.log10(0.25))).toBeLessThan(0.5)
    }
    const report = {
      startedAt,
      chrome: browser.version(),
      cpu: cpus()[0]?.model,
      os: [platform(), release(), arch()].join(' '),
      sampleRate: rate,
      warmupMs,
      windowMs,
      inputSha256: sha256(input),
      linearSha256: sha256(linear),
      captureSha256: captureHash,
      captureRate,
      captureCompatible: rate === captureRate,
      summary,
      measurements,
    }
    const file = info.outputPath('measurement.json')
    await writeFile(file, JSON.stringify(report) + '\n')
    console.log(rate + ' Hz', JSON.stringify(summary), file)
  })
}
