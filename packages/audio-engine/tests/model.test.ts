import { describe, it, expect } from 'vitest'
import {
  dbToGain,
  gainToDb,
  parsePreset,
  factoryPresets,
  defaults,
  defaultOrder,
  moduleIds,
  parameters,
  validParameter,
} from '../src/presets/config'
import { driveCurve } from '../src/effects/graph'
import { playbackPosition } from '../src/inputs/FileInput'
import { levels } from '../src/utils/wav'
import { seededRandom } from '../src/inputs/signals'
import { validateNam } from '../src/amps/nam'
describe('기본 DSP와 상태', () => {
  it('선형 진폭과 dB를 변환한다', () => {
    expect(dbToGain(-6.0206)).toBeCloseTo(0.5)
    expect(gainToDb(0)).toBe(-Infinity)
    expect(gainToDb(dbToGain(-26))).toBeCloseTo(-26)
  })
  it('RMS·Peak·클립을 계산한다', () => {
    expect(levels(new Float32Array([1, 0, -1, 0]))).toEqual({
      rms: Math.SQRT1_2,
      peak: 1,
      clip: true,
    })
  })
  it('왜곡 함수가 유한하고 대칭이다', () => {
    for (const hard of [true, false]) {
      const c = driveCurve(hard)
      expect(c[2048]).toBe(0)
      expect(c[100]).toBeCloseTo(-c[c.length - 101])
      expect(c.every((x) => Number.isFinite(x) && Math.abs(x) <= 1)).toBe(true)
    }
  })
  it('동일한 합성 IR 시드에서 같은 표본을 만든다', () => {
    const a = seededRandom(),
      b = seededRandom()
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })
  it('파일 재생 위치를 반복하거나 끝에서 멈춘다', () => {
    expect(playbackPosition(1, 4, 2, true)).toBe(1)
    expect(playbackPosition(1, 4, 2, false)).toBe(2)
    expect(playbackPosition(0, 4, 0, true)).toBe(0)
  })
  it('서로 독립된 체인과 유효 범위를 갖는다', () => {
    const a = defaults(),
      b = defaults()
    a.input.values.gain = 8
    a.eq.enabled = false
    expect(b.input.values.gain).toBe(0)
    expect(b.eq.enabled).toBe(true)
    for (const id of moduleIds)
      for (const [key, p] of Object.entries(parameters(id))) {
        expect(validParameter(id, key, p.initial)).toBe(true)
        expect(validParameter(id, key, Infinity)).toBe(false)
        expect(validParameter(id, key, p.max + 1)).toBe(false)
      }
  })
})
describe('버전이 지정된 로컬 파일', () => {
  it.each(factoryPresets)('$name JSON 왕복', (p) =>
    expect(parsePreset(JSON.parse(JSON.stringify(p)))).toEqual(p),
  )
  it('다른 스키마, 잘못된 파라미터 및 참조를 거부한다', () => {
    const p = structuredClone(factoryPresets[0])
    for (const version of [0, 4.5, 6, '5', NaN])
      expect(() => parsePreset({ ...p, version })).toThrow()
    expect(() => parsePreset({ ...p, ir: { name: 1, enabled: true } })).toThrow()
    p.settings.delay.values.feedback = 100
    expect(() => parsePreset(p)).toThrow()
  })
  it('v1의 파라미터와 자산 참조를 보존하고 기존 체인 순서를 복원한다', () => {
    const { order, ...p } = factoryPresets[4]
    const legacy = {
      ...p,
      version: 1,
      favorite: true,
      nam: { name: 'amp.nam', enabled: false, capture: 'amp' },
      ir: { name: 'cab.wav', enabled: true },
    }
    const migrated = parsePreset(legacy)
    expect(migrated).toEqual({ ...legacy, version: 5, order: defaultOrder })
    expect(migrated.order).not.toBe(order)
    expect(legacy).not.toHaveProperty('order')
  })
  it('v2의 사용자 순서를 유지하고 우회된 게이트를 앞에 추가한다', () => {
    const preset = factoryPresets[2]
    const { noiseGate, ...settings } = preset.settings
    const order = [...defaultOrder]
      .filter((id) => id !== 'noiseGate' && id !== 'chorus' && id !== 'tremolo')
      .reverse()
    const legacy = { ...preset, version: 2, settings, order }
    const migrated = parsePreset(legacy)
    expect(migrated).toEqual({
      ...preset,
      order: [
        'noiseGate',
        'reverb',
        'chorus',
        'tremolo',
        'delay',
        'eq',
        'cabinet',
        'nam',
        'distortion',
        'overdrive',
        'compressor',
      ],
    })
    expect(migrated.settings.noiseGate.enabled).toBe(false)
    expect(() => parsePreset({ ...legacy, order: ['noiseGate', ...order] })).toThrow('체인 순서')
    expect(() => parsePreset({ ...preset, settings })).toThrow()
    expect(() =>
      parsePreset({
        ...preset,
        settings: {
          ...settings,
          noiseGate: { ...noiseGate, values: { ...noiseGate.values, threshold: 0 } },
        },
      }),
    ).toThrow('범위')
  })
  it('v3에서 게이트 설정과 사용자 순서를 유지하고 Delay 앞에 꺼진 Chorus를 추가한다', () => {
    const p = structuredClone(factoryPresets[3])
    p.settings.noiseGate.enabled = true
    p.settings.noiseGate.values.hold = 85
    const { chorus, ...settings } = p.settings
    const legacyOrder = [
      'delay',
      'nam',
      'compressor',
      'noiseGate',
      'cabinet',
      'distortion',
      'overdrive',
      'eq',
      'reverb',
    ]
    const migrated = parsePreset({ ...p, version: 3, order: legacyOrder, settings })
    expect(migrated).toEqual({ ...p, order: ['chorus', 'tremolo', ...legacyOrder] })
    expect(migrated.settings.chorus.enabled).toBe(false)
    expect(() => parsePreset({ ...migrated, settings })).toThrow()
    expect(() => parsePreset({ ...migrated, version: 3 })).toThrow('체인 순서')
    const values = { ...chorus.values, rate: 2.4, depth: 7.5, mix: 72 }
    const custom = { ...migrated, settings: { ...settings, chorus: { enabled: true, values } } }
    expect(parsePreset(JSON.parse(JSON.stringify(custom)))).toEqual(custom)
    expect(() =>
      parsePreset({
        ...custom,
        settings: { ...settings, chorus: { enabled: true, values: { ...values, depth: 9 } } },
      }),
    ).toThrow('범위')
  })
  it('v4의 페달 순서·코러스 설정을 보존하고 꺼진 Tremolo를 Delay 바로 앞에 넣는다', () => {
    const preset = structuredClone(factoryPresets[3])
    preset.settings.chorus = { enabled: true, values: { rate: 2, depth: 7, mix: 65 } }
    const { tremolo, ...settings } = preset.settings
    const oldOrder = [...defaultOrder].filter((id) => id !== 'tremolo').reverse()
    const migrated = parsePreset({ ...preset, settings, order: oldOrder, version: 4 })
    expect(migrated.order.filter((id) => id !== 'tremolo')).toEqual(oldOrder)
    expect(migrated.order.indexOf('tremolo')).toBe(migrated.order.indexOf('delay') - 1)
    expect(migrated.settings).toEqual(preset.settings)
    expect(tremolo.enabled).toBe(false)
    expect(() => parsePreset({ ...migrated, settings })).toThrow('누락')
    expect(() => parsePreset({ ...migrated, version: 4 })).toThrow('체인 순서')
    for (const values of [
      { rate: 0.1, depth: 50 },
      { rate: 4, depth: 101 },
    ])
      expect(() =>
        parsePreset({ ...migrated, settings: { ...settings, tremolo: { enabled: true, values } } }),
      ).toThrow('범위')
  })
  it('v5는 중복, 누락, 고정 단과 알 수 없는 슬롯을 거부한다', () => {
    const rest = defaultOrder.slice(1)
    for (const order of [
      undefined,
      rest,
      ['eq', ...rest],
      ['input', ...rest],
      ['other', ...rest],
      [...defaultOrder, 'nam'],
    ])
      expect(() => parsePreset({ ...factoryPresets[0], order })).toThrow('체인 순서')
    const order = [...defaultOrder].reverse()
    expect(parsePreset({ ...factoryPresets[0], order }).order).toEqual(order)
  })
  it('NAM 채널 및 샘플레이트를 검증한다', () => {
    const p = {
      version: '0.5.4',
      architecture: 'Linear',
      config: { receptive_field: 1, bias: false },
      weights: [0.25],
      sample_rate: 48000,
    }
    expect(() => validateNam(JSON.stringify(p), 48000)).not.toThrow()
    for (const bad of [
      { ...p, sample_rate: -1 },
      { ...p, sample_rate: 44100 },
      { ...p, config: { in_channels: 2 } },
      { ...p, weights: [null] },
    ])
      expect(() => validateNam(JSON.stringify(bad), 48000)).toThrow()
  })
})
