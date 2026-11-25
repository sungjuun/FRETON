import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import {
  AudioEngine,
  factoryPresets,
  parsePreset,
  validParameter,
  type Preset,
  type ModuleId,
} from '@freton/audio-engine'
export const engine = new AudioEngine()
const subscribe = (fn: () => void) => {
  engine.addEventListener('change', fn)
  return () => engine.removeEventListener('change', fn)
}
export function useEngine() {
  useSyncExternalStore(subscribe, () => engine.revision)
  return engine
}
export const useStudio = create<{
  selected: ModuleId
  select: (id: ModuleId) => void
  dialog: 'presets' | 'input' | null
  open: (v: 'presets' | 'input' | null) => void
  library: Preset[]
  ready: boolean
}>((set) => ({
  selected: 'compressor',
  select: (selected) => set({ selected }),
  dialog: null,
  open: (dialog) => set({ dialog }),
  library: [],
  ready: false,
}))
export function execute(action: () => unknown) {
  try {
    Promise.resolve(action()).catch(engine.report)
  } catch (e) {
    engine.report(e)
  }
}
export function setParameter(id: ModuleId, key: string, value: number) {
  if (!validParameter(id, key, value)) return
  const p = engine.preset,
    mod = p.settings[id]
  engine.setPreset({
    ...p,
    settings: { ...p.settings, [id]: { ...mod, values: { ...mod.values, [key]: value } } },
  })
}
export function toggleModule(id: ModuleId) {
  const p = engine.preset
  engine.setPreset({
    ...p,
    settings: { ...p.settings, [id]: { ...p.settings[id], enabled: !p.settings[id].enabled } },
  })
}
let database: Promise<IDBDatabase> | undefined
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('freton-studio', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('presets', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((e) => {
    database = undefined
    throw e
  }))
}
export async function refreshPresets() {
  const database = await db()
  const records = await new Promise<unknown[]>((resolve, reject) => {
    const req = database.transaction('presets').objectStore('presets').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const all = new Map(factoryPresets.map((p) => [p.id, p]))
  for (const item of records) {
    try {
      const p = parsePreset(item)
      all.set(p.id, p)
    } catch (e) {
      engine.report(e)
    }
  }
  useStudio.setState({ library: [...all.values()], ready: true })
}
export async function storePreset(preset: Preset, remove = false) {
  const p = parsePreset(preset),
    database = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('presets', 'readwrite'),
      store = tx.objectStore('presets')
    if (remove) store.delete(p.id)
    else store.put(p)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
    tx.onerror = () => reject(tx.error)
  })
  await refreshPresets()
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const isFactory = (id: string) => factoryPresets.some((p) => p.id === id)
export const sourceNames = {
  test: '테스트 신호',
  guitar: '합성 기타',
  file: '오디오 파일',
  live: '라이브 입력',
}
export const signalNames = {
  sine: 'Sine',
  square: 'Square',
  triangle: 'Triangle',
  noise: 'White Noise',
  impulse: 'Impulse',
  sweep: 'Frequency Sweep',
  silence: 'Silence',
  guitar: 'Synthetic Guitar',
}
export const formatTime = (s: number) =>
  Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0')
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void engine.stop()
  })
