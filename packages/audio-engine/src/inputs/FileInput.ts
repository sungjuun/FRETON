export const playbackPosition = (
  offset: number,
  elapsed: number,
  duration: number,
  loop: boolean,
) =>
  duration > 0 ? (loop ? (offset + elapsed) % duration : Math.min(duration, offset + elapsed)) : 0
export interface AudioInput {
  disconnect(): void
}
export class FileInput implements AudioInput {
  private node?: AudioBufferSourceNode
  private offset = 0
  private started = 0
  loop = false
  constructor(
    readonly context: AudioContext,
    readonly buffer: AudioBuffer,
    private target: AudioNode,
    private changed: () => void,
  ) {}
  get playing() {
    return !!this.node
  }
  get position() {
    if (!this.node) return this.offset
    return playbackPosition(
      this.offset,
      this.context.currentTime - this.started,
      this.buffer.duration,
      this.loop,
    )
  }
  play() {
    if (this.node) return
    if (this.offset >= this.buffer.duration) this.offset = 0
    const node = this.context.createBufferSource()
    node.buffer = this.buffer
    node.loop = this.loop
    node.connect(this.target)
    this.node = node
    this.started = this.context.currentTime
    node.onended = () => {
      if (this.node === node) {
        node.disconnect()
        this.node = undefined
        this.offset = this.buffer.duration
        this.changed()
      }
    }
    node.start(0, this.offset)
    this.changed()
  }
  pause() {
    this.offset = this.position
    this.disconnect()
    this.changed()
  }
  stop() {
    this.disconnect()
    this.offset = 0
    this.changed()
  }
  seek(time: number) {
    if (!Number.isFinite(time)) return
    const resume = this.playing
    this.disconnect()
    this.offset = Math.max(0, Math.min(time, this.buffer.duration))
    if (resume && (this.loop || this.offset < this.buffer.duration)) this.play()
    else this.changed()
  }
  setLoop(value: boolean) {
    this.offset = this.position
    this.started = this.context.currentTime
    this.loop = value
    if (this.node) this.node.loop = value
  }
  disconnect() {
    if (this.node) {
      this.node.onended = null
      this.node.stop()
      this.node.disconnect()
      this.node = undefined
    }
  }
}
