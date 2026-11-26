import { create } from 'zustand'
import { readNamFile, type NamInfo } from '@freton/audio-engine'

export const useNamLibrary = create<{ models: NamInfo[] }>(() => ({ models: [] }))

async function transaction(mode: IDBTransactionMode, stores: string[]) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('freton-nam-library', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('models', { keyPath: 'sha256' })
      request.result.createObjectStore('files')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return db.transaction(stores, mode)
  } finally {
    // The active transaction finishes before the connection closes.
    db.close()
  }
}

function committed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? Error('모델 저장소 변경을 완료하지 못했습니다.'))
  })
}

function result<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function refreshModels() {
  const tx = await transaction('readonly', ['models'])
  const models: NamInfo[] = await result(tx.objectStore('models').getAll())
  models.sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.sha256.localeCompare(b.sha256))
  useNamLibrary.setState({ models })
}

export async function addModel(file: File) {
  const { info } = await readNamFile(file)
  const tx = await transaction('readwrite', ['models', 'files'])
  const models = tx.objectStore('models')
  const existing = models.getKey(info.sha256)
  existing.onsuccess = () => {
    if (existing.result === undefined) {
      models.add(info)
      tx.objectStore('files').add(file, info.sha256)
    }
  }
  await committed(tx)
  await refreshModels()
  return { sha256: info.sha256, added: existing.result === undefined }
}

export async function readModelFile(model: NamInfo) {
  const tx = await transaction('readonly', ['files'])
  const blob: unknown = await result(tx.objectStore('files').get(model.sha256))
  if (!(blob instanceof Blob))
    throw Error('저장된 모델 파일을 찾을 수 없습니다. 원본을 다시 추가하세요.')
  return new File([blob], model.name)
}

export async function deleteModel(sha256: string) {
  const tx = await transaction('readwrite', ['models', 'files'])
  tx.objectStore('models').delete(sha256)
  tx.objectStore('files').delete(sha256)
  await committed(tx)
  await refreshModels()
}
