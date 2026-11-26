import { expect, test } from '@playwright/test'
import type { AudioEngine } from '../packages/audio-engine/src/core/AudioEngine'
test('합성 MediaStream의 좌우 채널, 모니터 음소거, 트랙 해제와 늦은 권한 응답', async ({
  page,
}) => {
  await page.goto('/sandbox')
  await page.getByRole('button', { name: '엔진 시작', exact: true }).click()
  await expect(page.getByText('엔진 실행 중', { exact: true })).toBeVisible()
  const r = await page.evaluate(async () => {
    const e: AudioEngine = (await import(/* @vite-ignore */ '/src/studio.ts' as string)).engine
    const ctx = e.ctx!,
      streamNode = ctx.createMediaStreamDestination(),
      osc = ctx.createOscillator(),
      left = ctx.createGain(),
      right = ctx.createGain(),
      merge = ctx.createChannelMerger(2)
    left.gain.value = 0.15
    right.gain.value = 0.6
    osc.connect(left).connect(merge, 0, 0)
    osc.connect(right).connect(merge, 0, 1)
    merge.connect(streamNode)
    osc.start()
    const stream = streamNode.stream,
      track = stream.getAudioTracks()[0]
    // The source is an actual Web Audio stereo MediaStream. Only device acquisition and metadata are substituted.
    const settings = track.getSettings()
    Object.defineProperty(track, 'getSettings', { value: () => ({ ...settings, channelCount: 2 }) })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => stream,
    })
    await e.connectLive('test-device')
    const rms = async (meter: AnalyserNode) => {
      await new Promise((r) => setTimeout(r, 180))
      const buf = new Float32Array(2048)
      meter.getFloatTimeDomainData(buf)
      return Math.sqrt(buf.reduce((sum, v) => sum + v * v, 0) / buf.length)
    }
    const monitored = e.monitor,
      muted = await rms(e.outputMeter!)
    e.setChannel('left')
    const low = await rms(e.inputMeter!)
    e.setChannel('right')
    const high = await rms(e.inputMeter!)
    e.setMonitor(true)
    const out = await rms(e.outputMeter!)
    track.dispatchEvent(new Event('ended'))
    const unplugged = !e.live && track.readyState === 'ended' && !e.monitor
    const delayed = ctx.createMediaStreamDestination().stream
    let grant!: (stream: MediaStream) => void
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve
        }),
    })
    const request = e.connectLive('late-device')
    e.selectSource('guitar')
    grant(delayed)
    await request
    const cleaned = delayed.getAudioTracks()[0].readyState === 'ended' && e.source === 'guitar'
    osc.stop()
    osc.disconnect()
    left.disconnect()
    right.disconnect()
    merge.disconnect()
    streamNode.disconnect()
    await e.stop()
    return { monitored, muted, ratio: high / low, out, unplugged, cleaned, closed: ctx.state }
  })
  expect(r.monitored).toBe(false)
  expect(r.muted).toBe(0)
  expect(r.ratio).toBeCloseTo(4, 0)
  expect(r.out).toBeGreaterThan(0.0001)
  expect(r.unplugged).toBe(true)
  expect(r.cleaned).toBe(true)
  expect(r.closed).toBe('closed')
})
