import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import {
  Home,
  AudioWaveform,
  Music2,
  Sparkles,
  Library,
  Disc3,
  FolderOpen,
  Guitar,
  Settings2,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Power,
  Activity,
  CircleDot,
  Layers3,
  Volume2,
  VolumeX,
  X,
  Clock3,
  SlidersHorizontal,
} from 'lucide-react'
import { brand } from './config/brand'
import { engine, useEngine, useStudio, execute, refreshPresets, sourceNames } from './studio'
import { Rig, Sandbox, Settings } from './pages/Studio'
import { InputControls } from './components/InOut'
import { PresetManager } from './components/PresetManager'
import { Modal } from './components/Controls'
const nav = [
  {
    path: 'home',
    name: 'Home',
    icon: Home,
    group: '워크스페이스',
    desc: '최근 연습 곡과 녹음 기록',
  },
  {
    path: 'rig',
    name: 'Virtual Rig',
    icon: AudioWaveform,
    group: '워크스페이스',
    desc: '가상 앰프와 이펙터로 기타 톤을 설계하세요.',
  },
  {
    path: 'practice',
    name: 'Practice Room',
    icon: Music2,
    group: '워크스페이스',
    desc: '반주 재생과 구간 반복 연습',
  },
  {
    path: 'tone-ai',
    name: 'Tone AI',
    icon: Sparkles,
    group: '워크스페이스',
    desc: '보유 장비에 맞는 곡별 톤 추천',
  },
  {
    path: 'tones',
    name: 'Tone Library',
    icon: Library,
    group: '워크스페이스',
    desc: '프리셋 검색과 분류',
  },
  {
    path: 'cover',
    name: 'Cover Studio',
    icon: Disc3,
    group: '워크스페이스',
    desc: '기타 커버 녹음과 믹싱',
  },
  {
    path: 'library',
    name: 'My Library',
    icon: FolderOpen,
    group: '라이브러리',
    desc: '연습 파일과 개인 녹음 관리',
  },
  {
    path: 'gear',
    name: 'My Gear',
    icon: Guitar,
    group: '라이브러리',
    desc: '기타와 오디오 장비 관리',
  },
  {
    path: 'sandbox',
    name: 'Audio Sandbox',
    icon: FlaskConical,
    group: '도구',
    desc: '입력 신호를 생성하고 실제 처리 파형과 스펙트럼을 비교하세요.',
  },
  {
    path: 'settings',
    name: 'Settings',
    icon: Settings2,
    group: '도구',
    desc: '오디오 장치와 모니터링을 설정하세요.',
  },
]
function Workspace() {
  const { pathname } = useLocation(),
    current = nav.find((v) => '/' + v.path === pathname) ?? nav[1],
    e = useEngine(),
    { dialog, open } = useStudio()
  const [folded, setFolded] = useState(false),
    [dismissed, setDismissed] = useState<string>()
  useEffect(() => {
    execute(refreshPresets)
    const close = () => {
      void engine.stop()
    }
    window.addEventListener('pagehide', close)
    return () => window.removeEventListener('pagehide', close)
  }, [])
  useEffect(() => {
    document.title = current.name + ' · ' + brand.name
  }, [current])
  const running = e.ctx?.state === 'running'
  return (
    <div className={'app ' + (folded ? 'folded' : '')}>
      <aside className="sidebar">
        <div className="logo">
          <img src="/mark.svg" alt="" />
          <div>
            <strong>{brand.name}</strong>
            <small>{brand.descriptor}</small>
          </div>
        </div>
        <nav aria-label="스튜디오 메뉴">
          {['워크스페이스', '라이브러리', '도구'].map((group) => (
            <div className="nav-group" key={group}>
              <span>{group}</span>
              {nav
                .filter((v) => v.group === group)
                .map((v) => (
                  <NavLink key={v.path} to={'/' + v.path} title={v.name}>
                    <v.icon />
                    <span>{v.name}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <button
          className="fold"
          aria-label={folded ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={() => setFolded(!folded)}
        >
          {folded ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span>사이드바 접기</span>
        </button>
        <div className="sidebar-version">
          <CircleDot />
          <span>{brand.name} Studio</span>
          <small>v{brand.version}</small>
        </div>
      </aside>
      <div className="shell">
        <header className="top">
          <div className="crumb">
            <Layers3 />
            <span>스튜디오</span>
            <ChevronRight />
            <b>{current.name}</b>
          </div>
          <div className="transport">
            <span className="engine-state">
              <i className={'dot ' + (running ? 'green' : '')} />
              {e.busy ? '전환 중' : running ? '엔진 실행 중' : '엔진 대기'}
            </span>
            <button
              className={'engine-button ' + (running ? 'running' : '')}
              disabled={e.busy}
              onClick={() =>
                execute(() =>
                  e.ctx ? (e.ctx.state === 'suspended' ? e.start() : e.stop()) : e.start(),
                )
              }
            >
              <Power />
              {e.ctx ? (e.ctx.state === 'suspended' ? '엔진 재개' : '엔진 중지') : '엔진 시작'}
            </button>
          </div>
        </header>
        <main>
          <div className="page-title">
            <div className="title-mark">
              <current.icon />
            </div>
            <div>
              <h1>{current.name}</h1>
              <p>{current.desc}</p>
            </div>
          </div>
          {e.errors[0] && dismissed !== e.errors[0] && (
            <div className="error-banner" role="alert">
              {e.errors[0]}
              <button aria-label="오류 닫기" onClick={() => setDismissed(e.errors[0])}>
                <X />
              </button>
            </div>
          )}
          {(['nam', 'ir'] as const)
            .filter((k) => e.preset[k]?.enabled && !e.assetReady(k))
            .map((k) => (
              <p className="warning" key={k}>
                {k.toUpperCase()} 파일을 다시 선택하세요 · {e.preset[k]?.name}
              </p>
            ))}
          <Routes>
            <Route path="/" element={<Navigate to="/rig" replace />} />
            <Route path="/rig" element={<Rig />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/settings" element={<Settings />} />
            {nav
              .filter((v) => !['rig', 'sandbox', 'settings'].includes(v.path))
              .map((v) => (
                <Route
                  path={'/' + v.path}
                  key={v.path}
                  element={
                    <section className="planned">
                      <Clock3 />
                      <h2>개발 예정</h2>
                      <p>{v.name}은 후속 단계에서 제공할 예정입니다.</p>
                      <NavLink to="/rig">Virtual Rig 열기</NavLink>
                    </section>
                  }
                />
              ))}
            <Route path="*" element={<Navigate replace to="/rig" />} />
          </Routes>
        </main>
        <footer className="statusbar">
          <span>
            <Activity />
            <i className={'dot ' + (running ? 'green' : '')} />
            {e.ctx?.state ?? '엔진 정지'}
          </span>
          <span>
            SR <b>{e.ctx ? e.ctx.sampleRate / 1000 + ' kHz' : '—'}</b>
          </span>
          <button onClick={() => open('input')}>
            <SlidersHorizontal />
            {sourceNames[e.source]}
          </button>
          <button
            className="master-status"
            aria-pressed={e.muted}
            onClick={() => e.setMute(!e.muted)}
          >
            {e.muted ? <VolumeX /> : <Volume2 />}Master {e.muted ? 'Mute' : e.master + ' dB'}
          </button>
        </footer>
      </div>
      {dialog === 'presets' && <PresetManager />}
      {dialog === 'input' && (
        <Modal title="오디오 입력" close={() => open(null)}>
          <div className="dialog-body">
            <InputControls />
            {e.errors[0] && <p className="error">{e.errors[0]}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
export default function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  )
}
