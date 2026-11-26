/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return ['threshold', 'attack', 'hold', 'release'].map((name) => ({
      name,
      automationRate: 'k-rate',
    }))
  }

  constructor() {
    super()
    this.envelope = 0
    this.gain = 0
    this.open = false
    this.held = 0
    this.peakDecay = Math.exp(-1 / (0.008 * sampleRate))
    this.stopped = false
    this.port.onmessage = () => {
      this.stopped = true
    }
  }

  process(inputs, outputs, params) {
    if (this.stopped) return false
    const input = inputs[0],
      output = outputs[0]
    if (!input.length) {
      this.envelope = this.gain = this.held = 0
      this.open = false
      return true
    }
    const threshold = 10 ** (params.threshold[0] / 20)
    const closeThreshold = threshold * 10 ** (-6 / 20)
    const attackStep = 1 / Math.max(1, (params.attack[0] * sampleRate) / 1000)
    const releaseStep = 1 / Math.max(1, (params.release[0] * sampleRate) / 1000)
    const holdFrames = Math.round((params.hold[0] * sampleRate) / 1000)
    for (let i = 0; i < output[0].length; i++) {
      // Link channel peaks so opposite-phase stereo cannot cancel in the detector.
      let peak = 0
      for (let ch = 0; ch < input.length; ch++) peak = Math.max(peak, Math.abs(input[ch][i]))
      this.envelope = Math.max(peak, this.envelope * this.peakDecay)
      if (this.envelope >= (this.open ? closeThreshold : threshold)) {
        this.open = true
        this.held = 0
      } else if (this.open && ++this.held > holdFrames) {
        this.open = false
      }
      this.gain = this.open
        ? Math.min(1, this.gain + attackStep)
        : Math.max(0, this.gain - releaseStep)
      for (let ch = 0; ch < output.length; ch++) output[ch][i] = input[ch][i] * this.gain
    }
    return true
  }
}

registerProcessor('freton-noise-gate', NoiseGateProcessor)
