import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useEngine } from '../studio'
import { addModel, deleteModel, readModelFile, refreshModels, useNamLibrary } from '../namLibrary'
import { FilePick, Modal } from './Controls'

const captureNames = { amp: '앰프만', full: '앰프 + 캐비닛', unknown: '캡처 유형 미확인' }
const rateLabel = (rate: number) => rate.toLocaleString('ko-KR') + ' Hz'
function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError')
    return '브라우저 저장 공간이 부족합니다. 사용하지 않는 모델을 삭제한 뒤 다시 추가하세요.'
  return error instanceof Error ? error.message : String(error)
}

export function NamLibrary({ close }: { close: () => void }) {
  const e = useEngine()
  const models = useNamLibrary((state) => state.models)
  const [choice, setChoice] = useState(e.preset.nam ? (e.preset.nam.sha256 ?? '') : undefined)
  const [working, setWorking] = useState(false)
  const [ready, setReady] = useState(false)
  const [deleteHash, setDeleteHash] = useState<string>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const model = choice === undefined ? models[0] : models.find((item) => item.sha256 === choice)
  const active = !!model && e.namInfo?.sha256 === model.sha256 && e.assetReady('nam')
  const rate = e.ctx?.sampleRate
  const mismatch = model && rate !== undefined && rate !== model.sampleRate
  const busy = working || e.namBusy || e.busy

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      refreshModels().then(
        () => {
          if (mounted) setReady(true)
        },
        (err) => {
          if (mounted) setError(errorMessage(err))
        },
      )
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
    }
  }, [])

  async function run(action: () => Promise<void>) {
    setWorking(true)
    setDeleteHash(undefined)
    setMessage('')
    setError('')
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal title="NAM 모델 라이브러리" close={close}>
      <div className="stack dialog-body">
        <p className="note">
          추가한 .nam 파일은 이 브라우저에 저장됩니다. 연주에 사용할 모델을 선택한 뒤 적용하세요.
        </p>
        <FilePick
          label="라이브러리에 모델 추가"
          accept=".nam"
          disabled={busy}
          onFile={(file) =>
            void run(async () => {
              const saved = await addModel(file)
              setChoice(saved.sha256)
              setReady(true)
              setMessage(
                saved.added ? '모델을 저장했습니다.' : '같은 내용의 모델이 이미 저장되어 있습니다.',
              )
            })
          }
        />
        {models.length ? (
          <label>
            저장한 NAM 모델
            <select
              value={model?.sha256 ?? ''}
              disabled={busy}
              onChange={(event) => {
                setChoice(event.target.value)
                setDeleteHash(undefined)
                setError('')
                setMessage('')
              }}
            >
              {!model && (
                <option value="" disabled>
                  저장한 모델을 선택하세요
                </option>
              )}
              {models.map((item) => (
                <option value={item.sha256} key={item.sha256}>
                  {item.name} · {rateLabel(item.sampleRate)} · {item.sha256.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          ready && <p>저장한 모델이 없습니다.</p>
        )}
        {ready &&
          e.preset.nam?.sha256 &&
          !models.some((item) => item.sha256 === e.preset.nam?.sha256) &&
          !e.assetReady('nam') && (
            <small>
              프리셋에 저장된 {e.preset.nam.name}의 원본이 목록에 없습니다. 원본을 추가하거나 교체할
              모델을 선택하세요.
            </small>
          )}
        {model && (
          <>
            <small>
              {model.architecture} · {captureNames[model.capture]}
              {active && ' · 현재 연결됨'}
            </small>
            {mismatch && (
              <p className="warning">
                모델은 {rateLabel(model.sampleRate)}, 현재 엔진은 {rateLabel(rate)}입니다.
                Settings에서 모델 레이트를 선택하고 엔진을 재시작하세요.
              </p>
            )}
            {!e.ctx && <small>엔진을 시작하면 선택한 모델을 적용할 수 있습니다.</small>}
            <div className="actions">
              {!e.ctx ? (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void run(() => e.start())}
                >
                  엔진 시작
                </button>
              ) : (
                <button
                  className="primary"
                  aria-disabled={busy || mismatch || active}
                  onClick={() => {
                    if (busy || mismatch || active) return
                    void run(async () => {
                      await e.loadNam({ ...model, readFile: () => readModelFile(model) })
                      if (e.assetReady('nam') && e.namInfo?.sha256 === model.sha256)
                        setMessage('선택한 모델을 연결했습니다.')
                    })
                  }}
                >
                  모델 적용
                </button>
              )}
              <button disabled={busy} onClick={() => setDeleteHash(model.sha256)}>
                <Trash2 />
                목록에서 삭제
              </button>
            </div>
            {deleteHash === model.sha256 && (
              <div className="stack">
                <span>{model.name}을 이 브라우저의 라이브러리에서 삭제할까요?</span>
                <div className="actions">
                  <button
                    onClick={() =>
                      void run(async () => {
                        await deleteModel(model.sha256)
                        setChoice(undefined)
                        setMessage('라이브러리에서 삭제했습니다.')
                      })
                    }
                  >
                    삭제 확인
                  </button>
                  <button onClick={() => setDeleteHash(undefined)}>취소</button>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p role="status">{working ? '처리 중…' : message}</p>
      </div>
    </Modal>
  )
}
