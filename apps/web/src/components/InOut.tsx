import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Music2,
  AudioWaveform,
  Guitar,
  Cable,
  Play,
  Pause,
  Square,
  Repeat2,
  RefreshCw,
  Volume2,
  Activity,
} from 'lucide-react'
import {
  gainToDb,
  levels,
  signals,
  type Source,
  type Signal,
  type Channel,
} from '@freton/audio-engine'
import { engine, useEngine, execute, sourceNames, signalNames, formatTime } from '../studio'
import { FilePick, Range, Toggle } from './Controls'
export function LiveControls() {
  const e = useEngine()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [id, setId] = useState('')
  const refresh = async () => {
    if (!navigator.mediaDevices?.enumerateDevices)
      throw Error('이 브라우저에서는 오디오 장치를 조회할 수 없습니다.')
    const list = await navigator.mediaDevices.enumerateDevices()
    setDevices(list)
    setId((prev) => (list.some((d) => d.deviceId === prev) ? prev : ''))
  }
  useEffect(() => {
    const update = () => execute(refresh)
    update()
    navigator.mediaDevices?.addEventListener('devicechange', update)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', update)
  }, [])
  const settings = e.live?.settings
  const inputs = devices.filter((d) => d.kind === 'audioinput' && d.deviceId)
  return (
    <div className="stack">
      <div className="inline">
        <label className="grow">
          입력 장치
          <select
            aria-label="입력 장치"
            value={id}
            onChange={(ev) => {
              setId(ev.target.value)
              e.removeLive()
            }}
          >
            <option value="">기본 입력 (연결 시 권한 요청)</option>
            {inputs.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || '입력 ' + (i + 1)}
              </option>
            ))}
          </select>
        </label>
        <button className="icon" aria-label="장치 새로고침" onClick={() => execute(refresh)}>
          <RefreshCw />
        </button>
      </div>
      <button
        disabled={!e.ctx || e.busy}
        onClick={() =>
          execute(async () => {
            if (e.live) e.removeLive()
            else {
              await e.connectLive(id)
              await refresh()
            }
          })
        }
      >
        <Cable />
        {e.live ? '연결 해제' : '입력 연결'}
      </button>
      {e.live && (
        <>
          <label>
            입력 채널
            <select
              aria-label="입력 채널"
              value={e.channel}
              onChange={(v) => execute(() => e.setChannel(v.target.value as Channel))}
            >
              <option value="mono">Mono (합성)</option>
              {(settings?.channelCount ?? 0) >= 2 && (
                <>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </>
              )}
            </select>
          </label>
          <div className="row">
            <span>소프트웨어 모니터링</span>
            <Toggle
              label="소프트웨어 모니터링"
              value={e.monitor}
              change={() => e.setMonitor(!e.monitor)}
            />
          </div>
          <dl className="facts">
            {(['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const).map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  {typeof settings?.[k] === 'boolean'
                    ? settings[k]
                      ? '켜짐'
                      : '꺼짐'
                    : '지원되지 않음 / 미보고'}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <label>
        출력 장치
        <select
          aria-label="출력 장치"
          disabled={!e.ctx || !('setSinkId' in e.ctx)}
          value={e.sink}
          onChange={(ev) => execute(() => e.setOutput(ev.target.value))}
        >
          <option value="">
            {e.ctx && !('setSinkId' in e.ctx) ? '브라우저 선택 미지원' : '시스템 기본 출력'}
          </option>
          {devices
            .filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default')
            .map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || '출력 ' + (i + 1)}
              </option>
            ))}
        </select>
      </label>
    </div>
  )
}
function FileWave({ buffer }: { buffer: AudioBuffer }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!,
      g = c.getContext('2d')!
    const data = buffer.getChannelData(0)
    g.clearRect(0, 0, c.width, c.height)
    g.strokeStyle = '#d9a66d'
    g.beginPath()
    for (let x = 0; x < c.width; x++) {
      const a = Math.floor((x * data.length) / c.width),
        b = Math.min(data.length, Math.max(a + 1, Math.floor(((x + 1) * data.length) / c.width)))
      let low = 0,
        hi = 0
      for (let i = a; i < b; i++) {
        low = Math.min(low, data[i])
        hi = Math.max(hi, data[i])
      }
      g.moveTo(x, 24 - 23 * hi)
      g.lineTo(x, 24 - 23 * low)
    }
    g.stroke()
  }, [buffer])
  return (
    <canvas ref={ref} aria-label="선택 파일 파형" className="file-wave" width={640} height={48} />
  )
}
export function InputControls() {
  const e = useEngine(),
    [pos, setPos] = useState(0)
  useEffect(() => {
    if (!e.file) return
    const timer = setInterval(() => setPos(e.file?.position ?? 0), 120)
    return () => clearInterval(timer)
  }, [e, e.file])
  const icons = { test: AudioWaveform, guitar: Guitar, file: Music2, live: Cable }
  return (
    <div className="stack">
      <div className="source-grid">
        {(Object.keys(sourceNames) as Source[]).map((src) => {
          const Icon = icons[src]
          return (
            <button
              className={src === e.source ? 'chosen' : ''}
              key={src}
              aria-pressed={src === e.source}
              onClick={() => e.selectSource(src)}
            >
              <Icon />
              {sourceNames[src]}
            </button>
          )
        })}
      </div>
      {(e.source === 'test' || e.source === 'guitar') && (
        <>
          {e.source === 'test' ? (
            <label>
              파형
              <select
                aria-label="테스트 파형"
                value={e.signal}
                onChange={(ev) => e.setSignal(ev.target.value as Signal, e.frequency)}
              >
                {signals
                  .filter((s) => s !== 'guitar')
                  .map((s) => (
                    <option value={s} key={s}>
                      {signalNames[s]}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <p className="note">DSP 검증용 Karplus–Strong 합성 기타입니다.</p>
          )}
          <Range
            label="기준 주파수"
            value={e.frequency}
            min={20}
            max={8000}
            unit="Hz"
            change={(v) => e.setSignal(e.signal, v)}
          />
        </>
      )}
      {e.source === 'file' && (
        <div
          className="filebox stack"
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => {
            ev.preventDefault()
            const f = ev.dataTransfer.files[0]
            if (f) execute(() => e.loadFile(f))
          }}
        >
          <FilePick
            label="오디오 파일 선택"
            accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
            onFile={(f) => execute(() => e.loadFile(f))}
          />
          <p className="note">이곳에 파일을 놓으세요. 브라우저 안에서 디코딩합니다.</p>
          {e.fileBuffer && (
            <>
              <div className="row">
                <strong>{e.fileName}</strong>
                <button className="small" onClick={() => e.clearFile()}>
                  파일 해제
                </button>
              </div>
              <small>
                {e.fileBuffer.numberOfChannels} ch · {e.fileBuffer.sampleRate} Hz (디코딩) ·{' '}
                {(e.fileSize / 1024).toFixed(0)} KiB
              </small>
              <FileWave buffer={e.fileBuffer} />
              <Range
                label="재생 위치"
                min={0}
                max={e.fileBuffer.duration}
                value={Math.min(
                  e.fileBuffer.duration,
                  e.file?.playing ? pos : (e.file?.position ?? 0),
                )}
                step={0.01}
                unit="s"
                change={(v) => e.file?.seek(v)}
              />
              <div className="inline">
                <button
                  aria-label={e.file?.playing ? '일시정지' : '파일 재생'}
                  disabled={!e.file}
                  onClick={() => (e.file?.playing ? e.file.pause() : e.file?.play())}
                >
                  {e.file?.playing ? <Pause /> : <Play />}
                </button>
                <button aria-label="파일 정지" onClick={() => e.file?.stop()}>
                  <Square />
                </button>
                <button
                  aria-label="반복 재생"
                  aria-pressed={e.loop}
                  onClick={() => e.setLoop(!e.loop)}
                >
                  <Repeat2 />
                </button>
                <small>
                  {formatTime(e.file?.position ?? 0)} / {formatTime(e.fileBuffer.duration)}
                </small>
              </div>
            </>
          )}
        </div>
      )}
      {e.source === 'live' && <LiveControls />}
      <Range
        label="입력 레벨"
        min={-60}
        max={0}
        value={e.level}
        unit="dB"
        change={(v) => e.setLevel(v)}
      />
      {!e.ctx && <p className="note">상단의 엔진 시작을 눌러 입력을 사용하세요.</p>}
    </div>
  )
}
export function Scope({ side, full = false }: { side: 'input' | 'output'; full?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    meter = useRef<HTMLDivElement>(null),
    reading = useRef<HTMLSpanElement>(null),
    [spectrum, setSpectrum] = useState(false),
    clip = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let frame = 0,
      last = -1
    const wave = new Float32Array(2048),
      freq = new Uint8Array(1024)
    function draw(t: number) {
      frame = requestAnimationFrame(draw)
      if (t - last < 50) return
      last = t
      const analyser = side === 'input' ? engine.inputMeter : engine.outputMeter
      let peak = 0,
        rms = 0
      if (analyser) {
        analyser.getFloatTimeDomainData(wave)
        ;({ peak, rms } = levels(wave))
      } else wave.fill(0)
      const db = gainToDb(peak),
        rmsDb = gainToDb(rms)
      if (meter.current)
        meter.current.style.setProperty(
          '--used',
          (Number.isFinite(db) ? Math.max(0, Math.min(100, ((db + 60) / 60) * 100)) : 0) + '%',
        )
      if (reading.current)
        reading.current.textContent =
          (full ? 'RMS ' + (Number.isFinite(rmsDb) ? rmsDb.toFixed(1) : '−∞') + '  /  Peak ' : '') +
          (Number.isFinite(db) ? db.toFixed(1) : '−∞') +
          ' dBFS'
      if (clip.current) {
        clip.current.textContent = peak >= 0.999 ? 'CLIP' : full && analyser ? '클립 없음' : ''
        clip.current.className = peak >= 0.999 ? 'clip' : ''
      }
      const c = canvas.current,
        g = c?.getContext('2d')
      if (!c || !g) return
      g.clearRect(0, 0, c.width, c.height)
      g.strokeStyle = side === 'input' ? '#82acad' : '#d9a66d'
      g.lineWidth = 1.6
      g.beginPath()
      if (spectrum) {
        if (analyser) analyser.getByteFrequencyData(freq)
        else freq.fill(0)
        for (let x = 0; x < c.width; x++) {
          const i = Math.min(freq.length - 1, Math.floor(Math.pow(freq.length, x / c.width) - 1))
          g.moveTo(x, c.height)
          g.lineTo(x, c.height - (freq[i] / 255) * c.height)
        }
      } else {
        for (let x = 0; x < c.width; x++) {
          const y = c.height * (0.5 - 0.48 * wave[Math.floor((x * wave.length) / c.width)])
          if (x === 0) g.moveTo(x, y)
          else g.lineTo(x, y)
        }
      }
      g.stroke()
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [side, spectrum, full])
  return (
    <div className="scope">
      <div className="row">
        <b>
          {side === 'input' ? <AudioLines /> : <Volume2 />}
          {side === 'input' ? 'INPUT' : 'OUTPUT'}
        </b>
        <span className="meter-read" ref={reading}>
          −∞ dBFS
        </span>
      </div>
      {full && (
        <>
          <canvas
            className="scope-canvas"
            aria-label={(side === 'input' ? '입력' : '출력') + (spectrum ? ' 스펙트럼' : ' 파형')}
            ref={canvas}
            width={560}
            height={110}
          />
          <button className="small" onClick={() => setSpectrum(!spectrum)}>
            <Activity />
            {spectrum ? '스펙트럼 · 파형 보기' : '파형 · 스펙트럼 보기'}
          </button>
        </>
      )}
      <div className="meter-bar" ref={meter}>
        <i />
      </div>
      <div className="meter-scale">
        <span>−60</span>
        <span>−36</span>
        <span>−12</span>
        <span ref={clip} className="clip" />
        <span>0</span>
      </div>
    </div>
  )
}
