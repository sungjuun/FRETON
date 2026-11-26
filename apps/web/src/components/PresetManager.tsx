import { useState } from 'react'
import { Copy, Trash2, Star, Download, Save } from 'lucide-react'
import { parsePreset, factoryPresets } from '@freton/audio-engine'
import { useStudio, useEngine, execute, storePreset, isFactory, download } from '../studio'
import { Modal, FilePick } from './Controls'
export function PresetManager() {
  const e = useEngine(),
    { library, open, ready } = useStudio(),
    [name, setName] = useState(e.preset.name),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false)
  const p = e.preset
  async function save(mode: 'save' | 'copy') {
    const text = name.trim()
    if (!text || text.length > 200) throw Error('프리셋 이름은 1~200자로 입력하세요.')
    const next = parsePreset({
      ...p,
      id: isFactory(p.id) || mode === 'copy' ? crypto.randomUUID() : p.id,
      name: mode === 'copy' ? text + ' 복사본' : text,
    })
    await storePreset(next)
    e.setPreset(next)
    setName(next.name)
    setMessage('브라우저에 저장했습니다.')
  }
  return (
    <Modal title="프리셋 관리" close={() => open(null)}>
      <div className="stack dialog-body">
        <label>
          현재 프리셋
          <select
            value={p.id}
            onChange={(v) => {
              const next = library.find((f) => f.id === v.target.value)!
              e.setPreset(next)
              setName(next.name)
              setConfirm(false)
              setMessage('')
            }}
          >
            {library.map((v) => (
              <option key={v.id} value={v.id}>
                {v.favorite ? '★ ' : ''}
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          프리셋 이름
          <input
            type="text"
            maxLength={200}
            value={name}
            onChange={(v) => setName(v.target.value)}
          />
        </label>
        <div className="actions">
          <button className="primary" disabled={!ready} onClick={() => execute(() => save('save'))}>
            <Save />
            저장
          </button>
          <button disabled={!ready} onClick={() => execute(() => save('copy'))}>
            <Copy />
            복제
          </button>
          <button
            aria-pressed={p.favorite}
            disabled={!ready}
            onClick={() =>
              execute(async () => {
                const next = { ...p, favorite: !p.favorite }
                const stored = library.find((v) => v.id === p.id) ?? p
                await storePreset({ ...stored, favorite: next.favorite })
                e.setPreset(next)
              })
            }
          >
            <Star />
            즐겨찾기
          </button>
          <button disabled={isFactory(p.id)} onClick={() => setConfirm(true)}>
            <Trash2 />
            삭제
          </button>
        </div>
        {confirm && (
          <div className="inline">
            <span>이 프리셋을 삭제할까요?</span>
            <button
              onClick={() =>
                execute(async () => {
                  await storePreset(p, true)
                  e.setPreset(factoryPresets[0])
                  setName(e.preset.name)
                  setConfirm(false)
                  setMessage('삭제했습니다.')
                })
              }
            >
              삭제 확인
            </button>
            <button onClick={() => setConfirm(false)}>취소</button>
          </div>
        )}
        <div className="actions">
          <FilePick
            label="JSON 가져오기"
            accept=".json,application/json"
            onFile={(file) =>
              execute(async () => {
                if (file.size > 1024 * 1024) throw Error('1 MiB 이하의 프리셋 JSON을 선택하세요.')
                const imported = parsePreset(JSON.parse(await file.text()))
                imported.id = crypto.randomUUID()
                await storePreset(imported)
                e.setPreset(imported)
                setName(imported.name)
                setConfirm(false)
                setMessage('가져온 프리셋을 저장했습니다.')
              })
            }
          />
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }),
                p.name + '.json',
              )
            }
          >
            <Download />
            JSON 내보내기
          </button>
        </div>
        <p className="note">
          기본 프리셋은 새 사용자 프리셋으로 저장됩니다. 새 세션에서는 NAM 모델 라이브러리에서
          저장한 모델을 적용하거나 원본 파일을 다시 연결하세요. IR은 원본 WAV를 다시 선택하세요.
        </p>
        <p role="status">{message}</p>
        {e.errors[0] && <p className="error">{e.errors[0]}</p>}
      </div>
    </Modal>
  )
}
