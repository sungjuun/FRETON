export interface Parameter {
  label: string
  min: number
  max: number
  step: number
  initial: number
  unit: string
}
function range(
  label: string,
  min: number,
  max: number,
  step: number,
  initial: number,
  unit: string,
): Parameter {
  return { label, min, max, step, initial, unit }
}
export const modules = {
  input: {
    label: 'Input Gain',
    color: '#8b99a0',
    params: { gain: range('Gain', -24, 18, 0.5, 0, 'dB') },
  },
  compressor: {
    label: 'Compressor',
    color: '#547e80',
    params: {
      threshold: range('Threshold', -60, 0, 1, -24, 'dB'),
      ratio: range('Ratio', 1, 20, 0.1, 3, ':1'),
      attack: range('Attack', 1, 200, 1, 12, 'ms'),
      release: range('Release', 10, 1000, 1, 160, 'ms'),
      knee: range('Knee', 0, 40, 1, 18, 'dB'),
    },
  },
  overdrive: {
    label: 'Overdrive',
    color: '#ac7f42',
    params: {
      drive: range('Drive', 0, 100, 1, 22, '%'),
      tone: range('Tone', 400, 10000, 50, 4500, 'Hz'),
      level: range('Level', -30, 3, 0.5, -8, 'dB'),
    },
  },
  distortion: {
    label: 'Distortion',
    color: '#9e5b51',
    params: {
      gain: range('Gain', 0, 100, 1, 45, '%'),
      tone: range('Tone', 400, 10000, 50, 5200, 'Hz'),
      level: range('Level', -30, 3, 0.5, -13, 'dB'),
    },
  },
  eq: {
    label: 'Equalizer',
    color: '#688397',
    params: {
      bass: range('Bass', -12, 12, 0.5, 0, 'dB'),
      middle: range('Middle', -12, 12, 0.5, 0, 'dB'),
      treble: range('Treble', -12, 12, 0.5, 0, 'dB'),
    },
  },
  delay: {
    label: 'Delay',
    color: '#77759d',
    params: {
      time: range('Time', 10, 1000, 1, 300, 'ms'),
      feedback: range('Feedback', 0, 80, 1, 28, '%'),
      mix: range('Mix', 0, 75, 1, 20, '%'),
    },
  },
  reverb: {
    label: 'Reverb',
    color: '#70896d',
    params: { decay: range('Decay', 0.1, 4, 0.1, 1.4, 's'), mix: range('Mix', 0, 75, 1, 12, '%') },
  },
} as const
export type ModuleId = keyof typeof modules
export const moduleIds = Object.keys(modules) as ModuleId[]
export type ChainStage = Exclude<ModuleId, 'input'> | 'nam' | 'cabinet'
export const defaultOrder: readonly ChainStage[] = [
  'compressor',
  'overdrive',
  'distortion',
  'nam',
  'cabinet',
  'eq',
  'delay',
  'reverb',
]
export function assertChainOrder(order: unknown): asserts order is readonly ChainStage[] {
  if (
    !Array.isArray(order) ||
    order.length !== defaultOrder.length ||
    !defaultOrder.every((id) => order.includes(id))
  )
    throw Error('체인 순서에는 각 이펙터와 NAM·IR 슬롯이 한 번씩 있어야 합니다.')
}
export const parameters = (id: ModuleId): Readonly<Record<string, Parameter>> => modules[id].params
export type Settings = Record<ModuleId, { enabled: boolean; values: Record<string, number> }>
export type AssetRef = {
  name: string
  enabled: boolean
  sha256?: string
  capture?: 'amp' | 'full' | 'unknown'
}
export interface Preset {
  version: 2
  id: string
  name: string
  favorite: boolean
  settings: Settings
  order: readonly ChainStage[]
  nam: AssetRef | null
  ir: AssetRef | null
}
export const dbToGain = (db: number) => Math.pow(10, db / 20)
export const gainToDb = (gain: number) => (gain > 0 ? 20 * Math.log10(gain) : -Infinity)
export function defaults(): Settings {
  return Object.fromEntries(
    moduleIds.map((id) => [
      id,
      {
        enabled: ['input', 'eq', 'compressor', 'reverb'].includes(id),
        values: Object.fromEntries(
          Object.entries(parameters(id)).map(([key, p]) => [key, p.initial]),
        ),
      },
    ]),
  ) as Settings
}
function makePreset(
  id: string,
  name: string,
  changes: Partial<Record<ModuleId, Record<string, number>>>,
): Preset {
  const settings = defaults()
  for (const mod of moduleIds) {
    const values = changes[mod]
    if (values) {
      settings[mod].enabled = true
      Object.assign(settings[mod].values, values)
    }
  }
  return {
    version: 2,
    id,
    name,
    favorite: false,
    settings,
    order: [...defaultOrder],
    nam: null,
    ir: null,
  }
}
export const factoryPresets = [
  makePreset('studio-clean', 'Studio Clean', {}),
  makePreset('warm-clean', 'Warm Clean', {
    eq: { bass: 3, middle: 1.5, treble: -4 },
    reverb: { mix: 8 },
  }),
  makePreset('british-crunch', 'British Crunch', {
    overdrive: { drive: 46, level: -10 },
    eq: { middle: 4, bass: -2 },
  }),
  makePreset('indie-drive', 'Indie Drive', {
    overdrive: { drive: 30, tone: 3500 },
    delay: { time: 180, mix: 18 },
    eq: { treble: 2 },
  }),
  makePreset('modern-high-gain', 'Modern High Gain', {
    distortion: { gain: 81, tone: 5800 },
    eq: { middle: -5, bass: 4, treble: 3 },
  }),
  makePreset('ambient-lead', 'Ambient Lead', {
    overdrive: { drive: 36 },
    delay: { time: 430, feedback: 48, mix: 38 },
    reverb: { decay: 3.2, mix: 40 },
  }),
]
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const validName = (s: unknown): s is string =>
  typeof s === 'string' && s.trim().length > 0 && s.length <= 200
export function validParameter(id: ModuleId, key: string, value: unknown): value is number {
  const p = parameters(id)[key]
  return (
    !!p && typeof value === 'number' && Number.isFinite(value) && value >= p.min && value <= p.max
  )
}
export function parsePreset(value: unknown): Preset {
  if (
    !record(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !validName(value.name) ||
    !validName(value.id) ||
    typeof value.favorite !== 'boolean' ||
    !record(value.settings)
  )
    throw Error('지원하지 않는 프리셋 형식 또는 버전입니다.')
  const order = value.version === 1 ? defaultOrder : value.order
  assertChainOrder(order)
  const settings = defaults()
  for (const id of moduleIds) {
    const module = value.settings[id]
    if (!record(module) || typeof module.enabled !== 'boolean' || !record(module.values))
      throw Error('이펙터 설정이 누락되었습니다.')
    for (const key of Object.keys(parameters(id))) {
      const v = module.values[key]
      if (!validParameter(id, key, v)) throw Error(modules[id].label + ' · ' + key + ' 범위 오류')
      settings[id].values[key] = v
    }
    settings[id].enabled = module.enabled
  }
  function asset(v: unknown): AssetRef | null {
    if (v === null) return null
    if (!record(v) || !validName(v.name) || typeof v.enabled !== 'boolean')
      throw Error('모델 또는 IR 파일 정보 오류')
    const capture = v.capture
    if (capture !== undefined && capture !== 'amp' && capture !== 'full' && capture !== 'unknown')
      throw Error('캡처 유형 오류')
    if (
      v.sha256 !== undefined &&
      (typeof v.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.sha256))
    )
      throw Error('파일 지문 형식 오류')
    return { name: v.name, enabled: v.enabled, capture, sha256: v.sha256 }
  }
  return {
    version: 2,
    id: value.id,
    name: value.name.trim(),
    favorite: value.favorite,
    settings,
    order: [...order],
    nam: asset(value.nam),
    ir: asset(value.ir),
  }
}
