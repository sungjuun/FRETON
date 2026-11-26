import { useState } from 'react'
import { SlidersHorizontal, Activity, Cpu, Box, Trash2, AudioLines, Library } from 'lucide-react'
import { modules, moduleIds, parameters } from '@freton/audio-engine'
import { useEngine, useStudio, setParameter, toggleModule, execute, sourceNames } from '../studio'
import { Toggle, Range, FilePick } from './Controls'
import { NamLibrary } from './NamLibrary'
export function Inspector() {
  const e = useEngine(),
    { selected, select } = useStudio(),
    m = e.preset.settings[selected]
  return (
    <section className="panel inspector">
      <header className="panel-head">
        <h2>
          <SlidersHorizontal />
          파라미터
        </h2>
        <span className="cap">INSPECTOR</span>
      </header>
      <div className="inspector-body">
        <div className="mod-head">
          <div className="effect-icon" style={{ color: modules[selected].color }}>
            <AudioLines />
          </div>
          <div>
            <small>선택한 이펙터</small>
            <select
              aria-label="선택한 이펙터"
              value={selected}
              onChange={(v) => select(v.target.value as typeof selected)}
            >
              {moduleIds.map((id) => (
                <option key={id} value={id}>
                  {modules[id].label}
                </option>
              ))}
            </select>
          </div>
          <Toggle label="이펙터 활성화" value={m.enabled} change={() => toggleModule(selected)} />
        </div>
        <div className="knob-list">
          {selected === 'noiseGate' && (
            <small>
              Threshold에서 게이트가 열립니다. 음 끝이 짧으면 Hold나 Release를 늘려 보세요.
            </small>
          )}
          {Object.entries(parameters(selected)).map(([key, p]) => (
            <Range
              key={key}
              label={p.label}
              min={p.min}
              max={p.max}
              step={p.step}
              unit={p.unit}
              value={m.values[key]}
              change={(v) => setParameter(selected, key, v)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
export function ModelRack() {
  const e = useEngine()
  const [libraryOpen, setLibraryOpen] = useState(false)
  return (
    <section className="panel rack">
      <header className="panel-head">
        <h2>
          <Cpu />
          모델 & 캐비닛
        </h2>
      </header>
      {(['nam', 'ir'] as const).map((kind) => {
        const nam = kind === 'nam',
          ref = e.preset[kind],
          loaded = e.assetReady(kind)
        const missing = !!ref && !loaded
        const label = nam ? 'NAM' : 'IR'
        const pick = (file: File, restore = false) =>
          execute(() => (nam ? e.loadNam(file, restore) : e.loadIR(file, restore)))
        return (
          <details key={kind}>
            <summary>
              <span className="rack-icon">{nam ? <Cpu /> : <Box />}</span>
              <span>
                <strong>{nam ? 'NAM 모델' : 'Cabinet IR'}</strong>
                <small>
                  {nam && e.namBusy
                    ? '로딩 중…'
                    : ref
                      ? loaded
                        ? ref.name
                        : nam
                          ? '모델 다시 연결 필요'
                          : '파일 재선택 필요'
                      : '파일 미로드'}
                </small>
              </span>
            </summary>
            <div className="stack rack-fields">
              {nam && (
                <button
                  id="nam-library-button"
                  aria-haspopup="dialog"
                  onClick={() => setLibraryOpen(true)}
                >
                  <Library /> NAM 모델 라이브러리
                </button>
              )}
              <FilePick
                label={missing ? label + ' 원본 다시 연결' : nam ? 'NAM 파일 선택' : 'IR WAV 선택'}
                accept={nam ? '.nam' : '.wav'}
                disabled={!e.ctx || e.busy || e.namBusy}
                onFile={(f) => pick(f, missing)}
              />
              {missing && (
                <FilePick
                  label={label + ' 파일 교체'}
                  accept={nam ? '.nam' : '.wav'}
                  disabled={!e.ctx || e.busy || e.namBusy}
                  onFile={(file) => pick(file)}
                />
              )}
              {nam && loaded && e.namInfo && (
                <small>
                  {e.namInfo.architecture} · {e.namInfo.sampleRate.toLocaleString('ko-KR')} Hz
                </small>
              )}
              {!e.ctx && <small>엔진을 시작한 후 파일을 선택하세요.</small>}
              {ref && (
                <>
                  <div className="row">
                    <span>{loaded ? ref.name : '다시 선택 · ' + ref.name}</span>
                    <Toggle
                      label={nam ? 'NAM 활성화' : 'IR 활성화'}
                      disabled={!loaded}
                      value={loaded && ref.enabled}
                      change={() =>
                        e.setPreset({ ...e.preset, [kind]: { ...ref, enabled: !ref.enabled } })
                      }
                    />
                  </div>
                  {nam ? (
                    <label>
                      캡처 유형
                      <select
                        value={ref.capture ?? 'unknown'}
                        onChange={(v) =>
                          e.setPreset({
                            ...e.preset,
                            nam: { ...ref, capture: v.target.value as 'amp' | 'full' | 'unknown' },
                          })
                        }
                      >
                        <option value="unknown">확인 필요</option>
                        <option value="amp">앰프만</option>
                        <option value="full">앰프 + 캐비닛</option>
                      </select>
                    </label>
                  ) : (
                    loaded &&
                    e.irInfo && (
                      <small>
                        {e.irInfo.channels} ch · {e.irInfo.sourceRate} → {e.irInfo.renderRate} Hz ·{' '}
                        {e.irInfo.duration.toFixed(3)} s
                      </small>
                    )
                  )}
                  <button
                    className="small"
                    onClick={() => execute(() => (nam ? e.removeNam() : e.removeIR()))}
                  >
                    <Trash2 />
                    파일 해제
                  </button>
                </>
              )}
            </div>
          </details>
        )
      })}
      {libraryOpen && <NamLibrary close={() => setLibraryOpen(false)} />}
      {e.preset.nam?.enabled && e.preset.nam.capture === 'full' && e.preset.ir?.enabled && (
        <p className="note">
          이 프리셋은 캐비닛 포함 캡처와 별도 IR을 함께 사용하도록 설정되어 있습니다.
        </p>
      )}
    </section>
  )
}
export function Diagnostics() {
  const e = useEngine(),
    c = e.ctx
  const latency = (n: number | undefined) =>
    Number.isFinite(n) ? ((n ?? 0) * 1000).toFixed(2) + ' ms' : '미보고'
  const rows = [
    ['Audio Engine', e.busy ? '전환 중' : c ? '시작됨' : '정지'],
    ['AudioContext', c?.state ?? '미생성'],
    ['입력', sourceNames[e.source]],
    ['실제 장치', e.live?.name ?? '미연결'],
    ['샘플레이트', c ? c.sampleRate + ' Hz' : '—'],
    [
      '입력 채널',
      e.source === 'live'
        ? (e.live?.settings.channelCount ?? '미보고')
        : e.source === 'file'
          ? (e.fileBuffer?.numberOfChannels ?? '—')
          : c
            ? 1
            : '—',
    ],
    ['Base latency', latency(c?.baseLatency)],
    ['Output latency', latency(c?.outputLatency)],
    [
      'NAM',
      e.namBusy
        ? '로딩 중'
        : e.preset.nam
          ? e.assetReady('nam')
            ? e.preset.nam.enabled
              ? '활성'
              : '바이패스'
            : '재선택 필요'
          : '미로드',
    ],
    ['AudioWorklet', typeof AudioWorkletNode === 'function' ? '지원' : '미지원'],
    ['WebAssembly', typeof WebAssembly === 'object' ? '지원' : '미지원'],
  ]
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>
          <Activity />
          엔진 진단
        </h2>
      </header>
      <div className="panel-pad">
        <dl className="facts">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="note">
          지연시간은 브라우저 보고값입니다. 물리적 왕복 지연은 별도 측정합니다.
        </p>
        <details>
          <summary>최근 오류 ({e.errors.length})</summary>
          {e.errors.length ? (
            e.errors.map((v, i) => (
              <p className="error" key={i}>
                {v}
              </p>
            ))
          ) : (
            <small>기록 없음</small>
          )}
        </details>
      </div>
    </section>
  )
}
