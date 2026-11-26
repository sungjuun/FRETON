import { useState } from 'react'
import {
  Activity,
  AudioLines,
  AudioWaveform,
  ChevronLeft,
  ChevronRight,
  Save,
  ListMusic,
  Power,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  Download,
  SlidersHorizontal,
  Guitar,
  Cable,
  Settings2,
} from 'lucide-react'
import {
  modules,
  parameters,
  factoryPresets,
  engineSampleRates,
  wav,
  type AudioEngine,
  type ModuleId,
} from '@freton/audio-engine'
import { AmpHead, AmpKnob, RigPedal } from '../components/RigHardware'
import { Scope, InputControls, LiveControls } from '../components/InOut'
import { Inspector, ModelRack, Diagnostics } from '../components/Inspector'
import { Range, Toggle } from '../components/Controls'
import { ChainHeading, ChainRoute, isPedal } from '../components/SignalChain'
import { brand } from '../config/brand'
import {
  useEngine,
  useStudio,
  setParameter,
  toggleModule,
  execute,
  download,
  sourceNames,
} from '../studio'
export function PresetBar() {
  const e = useEngine(),
    { library, open } = useStudio(),
    list = library.length ? library : factoryPresets
  function advance(step: number) {
    const index = list.findIndex((p) => p.id === e.preset.id)
    e.setPreset(list[(index + list.length + step) % list.length])
  }
  return (
    <div className="preset-bar">
      <span className="preset-symbol">
        <ListMusic />
      </span>
      <div className="preset-select">
        <span className="cap">CURRENT PRESET</span>
        <select
          aria-label="현재 프리셋"
          value={e.preset.id}
          onChange={(v) => e.setPreset(list.find((p) => p.id === v.target.value)!)}
        >
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.favorite ? '★ ' : ''}
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="arrows">
        <button className="icon" aria-label="이전 프리셋" onClick={() => advance(-1)}>
          <ChevronLeft />
        </button>
        <button className="icon" aria-label="다음 프리셋" onClick={() => advance(1)}>
          <ChevronRight />
        </button>
      </div>
      <button className="preset-save" onClick={() => open('presets')}>
        <Save />
        프리셋 관리
      </button>
    </div>
  )
}
function Pedalboard() {
  const e = useEngine(),
    { selected, select } = useStudio()
  return (
    <section className="panel">
      <ChainHeading />
      <div className="pedalboard">
        {e.preset.order.filter(isPedal).map((id) => (
          <RigPedal
            key={id}
            name={modules[id].label}
            color={modules[id].color}
            selected={id === selected}
            active={e.preset.settings[id].enabled}
            onSelect={() => select(id)}
            onToggle={() => toggleModule(id)}
          />
        ))}
      </div>
      <ChainRoute />
    </section>
  )
}
function AB() {
  const e = useEngine()
  return (
    <div className="ab">
      <button aria-pressed={e.dry} onClick={() => e.setDry(true)}>
        A · DRY
      </button>
      <button aria-pressed={!e.dry} onClick={() => e.setDry(false)}>
        B · WET
      </button>
    </div>
  )
}
function Bypass() {
  const e = useEngine()
  return (
    <button className="small" aria-pressed={e.bypassed} onClick={() => e.setBypass(!e.bypassed)}>
      <Power />
      전체 Bypass
    </button>
  )
}
function OutputControls() {
  const e = useEngine()
  return (
    <div className="inline output-controls">
      <button
        className="icon"
        aria-label="출력 음소거"
        aria-pressed={e.muted}
        onClick={() => e.setMute(!e.muted)}
      >
        {e.muted ? <VolumeX /> : <Volume2 />}
      </button>
      <Range
        label="Master"
        min={-60}
        max={0}
        step={0.5}
        unit="dB"
        value={e.master}
        change={(v) => e.setMaster(v)}
      />
    </div>
  )
}
function ampPath(e: AudioEngine) {
  if (e.busy) return '엔진 전환 중'
  if (!e.ctx) return '엔진 대기'
  if (e.ctx.state !== 'running') return '엔진 일시정지'
  if (e.bypassed) return '원음 · 전체 Bypass'
  if (e.dry) return '원음 · Dry'
  if (e.preset.nam?.enabled)
    return e.assetReady('nam') ? 'NAM · ' + e.preset.nam.name : '기본 DSP · NAM 미연결'
  return '기본 DSP'
}
export function Rig() {
  const e = useEngine(),
    { open } = useStudio()
  const knobs: [ModuleId, string][] = [
    ['input', 'gain'],
    ['eq', 'bass'],
    ['eq', 'middle'],
    ['eq', 'treble'],
  ]
  return (
    <>
      <PresetBar />
      <div className="work-grid">
        <div className="stack">
          <section className="panel amp-panel">
            <header className="panel-head">
              <h2>
                <AudioWaveform />
                앰프 헤드
              </h2>
              <span className="cap">VIRTUAL AMPLIFIER</span>
            </header>
            <div className="amp-stage">
              <AmpHead
                brand={brand.name}
                preset={e.preset.name}
                powered={e.ctx?.state === 'running'}
              >
                {knobs.map(([id, key]) => {
                  const p = parameters(id)[key]
                  return (
                    <AmpKnob
                      key={key}
                      label={p.label}
                      value={e.preset.settings[id].values[key]}
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      defaultValue={p.initial}
                      unit={p.unit}
                      onChange={(v) => setParameter(id, key, v)}
                    />
                  )
                })}
                <AmpKnob
                  label="Master"
                  value={e.master}
                  min={-60}
                  max={0}
                  step={0.5}
                  unit="dB"
                  defaultValue={-24}
                  onChange={(v) => e.setMaster(v)}
                />
              </AmpHead>
            </div>
            <div className="amp-foot">
              <span role="status" aria-label="앰프 신호 경로">
                <i className="dot gold" />
                {ampPath(e)}
              </span>
              <AB />
              <Bypass />
            </div>
          </section>
          <Pedalboard />
          <section className="panel">
            <header className="panel-head">
              <h2>
                <Activity />
                입출력 모니터
              </h2>
              <button
                className="text-button"
                aria-haspopup="dialog"
                aria-label={'입력 설정 · ' + sourceNames[e.source]}
                onClick={() => open('input')}
              >
                <Cable />
                {sourceNames[e.source]}
                <Settings2 />
              </button>
            </header>
            <div className="meters">
              <Scope side="input" />
              <Scope side="output" />
            </div>
          </section>
        </div>
        <aside className="stack">
          <Inspector />
          <ModelRack />
        </aside>
      </div>
    </>
  )
}
export function Sandbox() {
  const e = useEngine(),
    [rendering, setRendering] = useState(false)
  async function render(dry: boolean) {
    setRendering(true)
    try {
      download(wav(await e.exportAudio(dry)), (dry ? 'Dry' : 'Wet') + '-' + e.preset.name + '.wav')
    } finally {
      setRendering(false)
    }
  }
  return (
    <>
      <PresetBar />
      <div className="sandbox-grid">
        <div className="stack">
          <section className="panel">
            <header className="panel-head">
              <h2>
                <Guitar />
                입력 소스
              </h2>
            </header>
            <div className="panel-pad">
              <InputControls />
            </div>
          </section>
          <section className="panel">
            <header className="panel-head">
              <h2>
                <ArrowRightLeft />
                출력 비교
              </h2>
            </header>
            <div className="panel-pad stack">
              <div className="inline">
                <AB />
                <Bypass />
              </div>
              <OutputControls />
              <div className="actions">
                {[true, false].map((d) => (
                  <button
                    key={String(d)}
                    disabled={
                      !e.ctx ||
                      e.busy ||
                      rendering ||
                      e.source === 'live' ||
                      (!d && !e.bypassed && !e.dry && e.preset.nam?.enabled)
                    }
                    onClick={() => execute(() => render(d))}
                  >
                    <Download />
                    {d ? 'Dry' : 'Wet'} WAV
                  </button>
                ))}
              </div>
              <small>
                {rendering
                  ? 'WAV 렌더링 중…'
                  : '선택한 입력 전체를 현재 레벨로 렌더합니다. Wet은 현재 바이패스 상태를 따릅니다. NAM 오프라인 출력은 미지원입니다.'}
              </small>
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <header className="panel-head">
              <h2>
                <AudioLines />
                신호 분석
              </h2>
            </header>
            <div className="panel-pad stack">
              <Scope side="input" full />
              <Scope side="output" full />
            </div>
          </section>
          <section className="panel">
            <ChainHeading />
            <div className="fx-list panel-pad">
              {['input' as const, ...e.preset.order.filter(isPedal)].map((id) => (
                <div className="row" key={id}>
                  <button onClick={() => useStudio.getState().select(id)}>
                    {modules[id].label}
                  </button>
                  <Toggle
                    label={modules[id].label + ' 활성화'}
                    value={e.preset.settings[id].enabled}
                    change={() => toggleModule(id)}
                  />
                </div>
              ))}
            </div>
            <ChainRoute />
          </section>
        </div>
        <aside className="stack">
          <Inspector />
          <Diagnostics />
          <ModelRack />
        </aside>
      </div>
    </>
  )
}
export function Settings() {
  const e = useEngine()
  return (
    <div className="settings-grid">
      <section className="panel">
        <header className="panel-head">
          <h2>
            <SlidersHorizontal />
            오디오 설정
          </h2>
        </header>
        <div className="panel-pad stack">
          <LiveControls />
          <label>
            엔진 샘플레이트
            <select
              value={e.requestedSampleRate ?? ''}
              disabled={e.busy}
              onChange={(event) => e.setSampleRate(Number(event.target.value) || undefined)}
            >
              <option value="">출력 장치 기본값</option>
              {engineSampleRates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate.toLocaleString('ko-KR')} Hz
                </option>
              ))}
            </select>
          </label>
          <small>다음 엔진 시작에 적용됩니다. NAM 모델에 표시된 레이트를 선택하세요.</small>
          <OutputControls />
          <button
            disabled={!e.ctx || e.busy}
            onClick={() =>
              execute(async () => {
                await e.stop()
                await e.start()
              })
            }
          >
            오디오 엔진 재시작
          </button>
        </div>
      </section>
      <Diagnostics />
    </div>
  )
}
