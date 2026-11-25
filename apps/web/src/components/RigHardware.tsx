import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import './hardware.css'

type AmpHeadProps = {
  brand: string
  preset: string
  powered: boolean
  children: ReactNode
}

export function AmpHead({ brand, preset, powered, children }: AmpHeadProps) {
  return (
    <section className="rig-hw-amp" aria-label={`${brand} 가상 앰프, ${preset}`}>
      <div className="rig-hw-handle" aria-hidden="true">
        <i />
      </div>
      <div className="rig-hw-shell">
        <i className="rig-hw-guard is-nw" aria-hidden="true" />
        <i className="rig-hw-guard is-ne" aria-hidden="true" />
        <i className="rig-hw-guard is-sw" aria-hidden="true" />
        <i className="rig-hw-guard is-se" aria-hidden="true" />
        <div className="rig-hw-grille" aria-hidden="true">
          <div className="rig-hw-insignia">
            <span className="rig-hw-fretmark">
              <i />
              <i />
              <i />
            </span>
            <span>{brand}</span>
          </div>
          <span className="rig-hw-preset">{preset}</span>
        </div>
        <div className="rig-hw-face">
          <div className="rig-hw-input" aria-hidden="true">
            <span>INPUT</span>
            <i className="rig-hw-jack" />
          </div>
          <div className="rig-hw-controls">{children}</div>
          <div className="rig-hw-pilot" aria-label={powered ? '엔진 켜짐' : '엔진 꺼짐'}>
            <span>POWER</span>
            <i data-lit={powered} />
          </div>
        </div>
      </div>
      <div className="rig-hw-feet" aria-hidden="true">
        <i />
        <i />
      </div>
    </section>
  )
}

type AmpKnobProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  unit?: string
  onChange: (value: number) => void
}

export function AmpKnob({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  unit = '',
  onChange,
}: AmpKnobProps) {
  const drag = useRef<{ id: number; y: number; value: number } | null>(null)
  const angle = -135 + ((value - min) / (max - min)) * 270
  const display = `${Number(value.toFixed(6))}${unit ? ` ${unit}` : ''}`

  function setValue(next: number) {
    const snapped = min + Math.round((next - min) / step) * step
    onChange(Number(Math.min(max, Math.max(min, snapped)).toFixed(8)))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, y: event.clientY, value }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || event.pointerId !== drag.current.id) return
    const delta = ((drag.current.y - event.clientY) * (max - min)) / 160
    setValue(drag.current.value + delta)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const changes: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + 10 * step,
      PageDown: value - 10 * step,
      Home: min,
      End: max,
      Delete: defaultValue,
      Backspace: defaultValue,
    }
    if (Object.prototype.hasOwnProperty.call(changes, event.key)) {
      event.preventDefault()
      setValue(changes[event.key])
    }
  }

  return (
    <div
      className="rig-hw-knob"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={display}
      aria-description="위아래로 드래그하거나 방향키로 조절합니다. 두 번 클릭하거나 Delete 키로 기본값을 복원합니다."
      title={`${label} · ${display} · 드래그 또는 방향키로 조절 · 두 번 클릭해 기본값 복원`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onLostPointerCapture={() => {
        drag.current = null
      }}
      onKeyDown={onKeyDown}
      onDoubleClick={() => setValue(defaultValue)}
    >
      <span className="rig-hw-knob-label">{label}</span>
      <span className="rig-hw-dial" aria-hidden="true">
        <span className="rig-hw-dial-cap">
          <i style={{ transform: `rotate(${angle}deg)` }} />
        </span>
      </span>
      <span className="rig-hw-reading">{display}</span>
    </div>
  )
}

type RigPedalProps = {
  color: string
  name: string
  active: boolean
  selected: boolean
  onSelect: () => void
  onToggle: () => void
}

export function RigPedal({ color, name, active, selected, onSelect, onToggle }: RigPedalProps) {
  const style = { '--hw-pedal-color': color } as CSSProperties
  return (
    <div className="rig-hw-pedal" style={style} data-selected={selected} data-active={active}>
      <button
        type="button"
        className="rig-hw-pedal-select"
        aria-label={`${name} 파라미터 선택`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="rig-hw-mini-dials" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="rig-hw-pedal-name">{name}</span>
      </button>
      <button
        type="button"
        className="rig-hw-pedal-switch"
        aria-label={`${name} 활성화`}
        aria-pressed={active}
        title={`${name} ${active ? '바이패스' : '활성화'}`}
        onClick={onToggle}
      >
        <i className="rig-hw-stomp" aria-hidden="true" />
        <i className="rig-hw-pedal-led" aria-hidden="true" />
      </button>
    </div>
  )
}
