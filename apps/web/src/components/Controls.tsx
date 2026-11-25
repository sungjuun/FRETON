import { useEffect, useRef, type ReactNode } from 'react'
import { X, Upload } from 'lucide-react'
export function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!
    d.showModal()
    return () => d.close()
  }, [])
  return (
    <dialog
      aria-label={title}
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
    >
      <div className="dialog-content">
        <header className="panel-head">
          <h2>{title}</h2>
          <button className="icon" aria-label="닫기" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
export function Toggle({
  value,
  change,
  label,
  disabled,
}: {
  value: boolean
  change: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-label={label}
      aria-checked={value}
      disabled={disabled}
      onClick={change}
    >
      <i />
    </button>
  )
}
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  change,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  change: (v: number) => void
}) {
  return (
    <label className="range-row">
      <span>
        {label}
        <output>
          {Number(value.toFixed(2))} {unit}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        style={{
          background: `linear-gradient(to right,var(--accent) ${(100 * (value - min)) / (max - min)}%,var(--line) 0)`,
        }}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  )
}
export function FilePick({
  label,
  accept,
  onFile,
  disabled = false,
}: {
  label: string
  accept: string
  onFile: (f: File) => void
  disabled?: boolean
}) {
  return (
    <label className={'filepick' + (disabled ? ' disabled' : '')}>
      <Upload size={15} />
      {label}
      <input
        aria-label={label}
        type="file"
        disabled={disabled}
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
    </label>
  )
}
