import type { NamNode } from 'neural-amp-modeler-wasm/engine'
import { smooth, type SwitchPath } from '../effects/graph'
import type { AssetRef } from '../presets/config'
import { fingerprint, verifyRestore } from '../utils/fingerprint'

export interface NamInfo {
  name: string
  sha256: string
  sampleRate: number
  architecture: string
  capture: NonNullable<AssetRef['capture']>
}
export function validateNam(raw: string, rate?: number) {
  let model
  try {
    model = JSON.parse(raw)
  } catch {
    throw Error('NAM 파일의 JSON 형식이 올바르지 않습니다.')
  }
  if (
    !model ||
    typeof model.version !== 'string' ||
    typeof model.architecture !== 'string' ||
    !model.config ||
    typeof model.config !== 'object' ||
    !Array.isArray(model.weights) ||
    !model.weights.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))
  )
    throw Error('NAM 구조 또는 가중치가 올바르지 않습니다.')
  if ((model.config.in_channels ?? 1) !== 1 || (model.config.out_channels ?? 1) !== 1)
    throw Error('모노 NAM 모델만 지원합니다.')
  if (
    model.architecture === 'Linear' &&
    (!Number.isSafeInteger(model.config.receptive_field) ||
      model.config.receptive_field < 1 ||
      model.weights.length !== model.config.receptive_field + (model.config.bias ? 1 : 0))
  )
    throw Error('Linear NAM 계수의 수가 설정과 일치하지 않습니다.')
  if (!Number.isFinite(model.sample_rate) || model.sample_rate <= 0)
    throw Error('모델의 요구 샘플레이트를 확인할 수 없습니다.')
  const sampleRate: number = model.sample_rate
  if (rate !== undefined && sampleRate !== rate)
    throw Error(
      'NAM ' +
        model.sample_rate +
        ' Hz / 현재 엔진 ' +
        rate +
        ' Hz · 샘플레이트가 다릅니다. Settings에서 엔진 레이트를 선택한 후 재시작하세요.',
    )
  const type = model.metadata?.gear_type
  const capture: NamInfo['capture'] =
    type === 'amp_cab' || type === 'amp_pedal_cab' ? 'full' : type === 'amp' ? 'amp' : 'unknown'
  return { sampleRate, architecture: String(model.architecture), capture }
}
export async function readNamFile(file: File, rate?: number) {
  if (!/\.nam$/i.test(file.name) || file.size > 32 * 1024 ** 2)
    throw Error('32 MiB 이하의 .nam 파일을 선택하세요.')
  const bytes = await file.arrayBuffer(),
    raw = new TextDecoder().decode(bytes)
  const info: NamInfo = {
    ...validateNam(raw, rate),
    name: file.name,
    sha256: await fingerprint(bytes),
  }
  return { raw, info }
}
// A failed worklet cannot acknowledge messages. Bound the wait so the native rig can stop.
async function reply<T>(operation: Promise<T>, node?: NamNode): Promise<T> {
  let rejectFailure!: (error: Error) => void
  const interrupted = new Promise<never>((_, reject) => {
    rejectFailure = reject
  })
  const fail = () =>
    rejectFailure(Error('NAM 프로세서 응답이 중단되었습니다. 모델 또는 엔진을 다시 시작하세요.'))
  const timer = setTimeout(fail, 8000)
  node?.addEventListener('processorerror', fail)
  try {
    return await Promise.race([operation, interrupted])
  } finally {
    clearTimeout(timer)
    node?.removeEventListener('processorerror', fail)
  }
}
async function dispose(node: NamNode) {
  try {
    await reply(node.dispose(), node)
  } finally {
    node.disconnect()
    node.port.close()
  }
}
export class NamSlot {
  private active?: { node: NamNode; gain: GainNode }
  constructor(
    private ctx: AudioContext,
    private path: SwitchPath,
    private failed: () => void,
  ) {}
  async prepare(file: File, expected?: Pick<AssetRef, 'name' | 'sha256'>) {
    const { raw, info } = await readNamFile(file, this.ctx.sampleRate)
    verifyRestore(expected, info)
    const { NamEngine } = await import('neural-amp-modeler-wasm/engine')
    const engine = await reply(NamEngine.attach(this.ctx)),
      node = await reply(engine.createNode())
    try {
      const result = await reply(node.loadModel(raw), node)
      if (result.expectedSampleRate !== this.ctx.sampleRate)
        throw Error('NAM 엔진이 보고한 샘플레이트가 다릅니다.')
      return { info, node, discard: () => dispose(node) }
    } catch (e) {
      await dispose(node)
      throw e
    }
  }
  // Commit the new branch synchronously; a late file load can be discarded before this point.
  install(node: NamNode) {
    const previous = this.active
    const gain = this.ctx.createGain()
    gain.gain.value = previous ? 0 : 1
    this.path.send.connect(node).connect(gain).connect(this.path.receive)
    this.active = { node, gain }
    node.onprocessorerror = () => {
      this.path.mix(0)
      this.path.send.disconnect(node)
      node.disconnect()
      gain.disconnect()
      node.port.close()
      this.active = undefined
      this.failed()
    }
    if (previous) smooth(gain.gain, 1, this.ctx)
    return this.retire(previous)
  }
  private async retire(branch: typeof this.active) {
    if (!branch) return
    const { node: old, gain } = branch
    old.onprocessorerror = null
    smooth(gain.gain, 0, this.ctx)
    await new Promise((r) => setTimeout(r, 12))
    this.path.send.disconnect(old)
    gain.disconnect()
    try {
      await reply(old.unloadModel(), old)
    } finally {
      await dispose(old)
    }
  }
  remove() {
    this.path.mix(0)
    const old = this.active
    this.active = undefined
    return this.retire(old)
  }
  get loaded() {
    return !!this.active
  }
}
