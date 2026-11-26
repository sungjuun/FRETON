import type { AssetRef } from '../presets/config'

type FileIdentity = Pick<AssetRef, 'name' | 'sha256'>
export function sameAsset(ref: FileIdentity, file: { name: string; sha256: string }) {
  return ref.sha256 ? file.sha256 === ref.sha256 : file.name === ref.name
}
export function verifyRestore(
  ref: FileIdentity | undefined,
  file: { name: string; sha256: string },
) {
  if (ref && !sameAsset(ref, file))
    throw Error('저장된 파일과 일치하지 않습니다. 원본을 선택하거나 파일 교체를 사용하세요.')
}

export async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
