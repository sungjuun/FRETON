import { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Link2, ListOrdered, RotateCcw } from 'lucide-react'
import { defaultOrder, modules, type ChainStage } from '@freton/audio-engine'
import { useEngine } from '../studio'
import { Modal } from './Controls'

const shortNames: Record<ChainStage, string> = {
  compressor: 'COMP',
  overdrive: 'OD',
  distortion: 'DIST',
  nam: 'NAM',
  cabinet: 'IR',
  eq: 'EQ',
  delay: 'DLY',
  reverb: 'REV',
}
export const isPedal = (id: ChainStage) => id !== 'nam' && id !== 'cabinet'
const stageName = (id: ChainStage) =>
  isPedal(id) ? modules[id].label : id === 'nam' ? 'NAM 모델' : 'Cabinet IR'

export function ChainRoute() {
  const { preset } = useEngine()
  return (
    <ol className="chain-foot" aria-label="현재 신호 순서">
      <li>IN</li>
      {preset.order.map((id) => (
        <li key={id} title={stageName(id)}>
          {shortNames[id]}
        </li>
      ))}
      <li>OUT</li>
    </ol>
  )
}

function ChainEditor({ close }: { close: () => void }) {
  const e = useEngine()
  const { order } = e.preset
  const [dragging, setDragging] = useState<ChainStage | null>(null)
  const [message, setMessage] = useState('')
  function move(id: ChainStage, to: number) {
    const from = order.indexOf(id)
    if (from === to || to < 0 || to >= order.length) return
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, id)
    e.setPreset({ ...e.preset, order: next })
    setMessage(stageName(id) + ' · ' + (to + 1) + '번째')
  }
  return (
    <Modal title="이펙터 순서 편집" close={close}>
      <div className="dialog-body chain-editor">
        <p>위에서 아래로 신호가 흐릅니다. 드래그하거나 화살표로 이동하세요.</p>
        <div className="chain-end">IN · Input Gain</div>
        <ol aria-label="이동 가능한 이펙터">
          {order.map((id, i) => (
            <li
              key={id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', id)
                setDragging(id)
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => {
                if (dragging) event.preventDefault()
              }}
              onDrop={(event) => {
                if (!dragging) return
                event.preventDefault()
                move(dragging, i)
                setDragging(null)
              }}
            >
              <GripVertical className="chain-grip" aria-hidden="true" />
              <span className="stage-name">
                <b>{String(i + 1).padStart(2, '0')}</b>
                {stageName(id)}
              </span>
              <button
                className="icon"
                disabled={i === 0}
                aria-label={stageName(id) + ' 앞으로'}
                onClick={() => move(id, i - 1)}
              >
                <ArrowUp />
              </button>
              <button
                className="icon"
                disabled={i === order.length - 1}
                aria-label={stageName(id) + ' 뒤로'}
                onClick={() => move(id, i + 1)}
              >
                <ArrowDown />
              </button>
            </li>
          ))}
        </ol>
        <div className="chain-end">OUT · Master</div>
        <div className="row chain-actions">
          <button
            className="small"
            disabled={order.every((id, i) => id === defaultOrder[i])}
            onClick={() => {
              e.setPreset({ ...e.preset, order: [...defaultOrder] })
              setMessage('기본 순서로 복원했습니다.')
            }}
          >
            <RotateCcw />
            기본 순서
          </button>
          <small role="status">{message}</small>
        </div>
      </div>
    </Modal>
  )
}

export function ChainHeading() {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <header className="panel-head">
        <h2>
          <Link2 />
          이펙터 체인
        </h2>
        <button className="small" onClick={() => setEditing(true)}>
          <ListOrdered />
          순서 편집
        </button>
      </header>
      {editing && <ChainEditor close={() => setEditing(false)} />}
    </>
  )
}
