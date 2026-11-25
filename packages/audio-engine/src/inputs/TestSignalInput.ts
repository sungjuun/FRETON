import type { AudioInput } from './FileInput'
import { signalBuffer, type Signal } from './signals'
export class TestSignalInput implements AudioInput {
  readonly buffer: AudioBuffer
  private source: AudioBufferSourceNode
  constructor(ctx: AudioContext, kind: Signal, frequency: number, target: AudioNode) {
    this.buffer = signalBuffer(ctx, kind, frequency)
    this.source = ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.source.loop = true
    this.source.connect(target)
    this.source.start()
  }
  disconnect() {
    this.source.stop()
    this.source.disconnect()
  }
}
