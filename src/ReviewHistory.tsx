import { ClipboardCheck, History, Save } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'

type ReviewStatus = 'approved' | 'revision' | 'rejected'

const statusLabels: Record<ReviewStatus, string> = {
  approved: '승인',
  revision: '수정 요청',
  rejected: '반려',
}

const reviewDate = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
})

export type ReviewSelection = {
  branchName: string
  sectionLabel: string
  text: string
  candidateId?: string
  isEdited?: boolean
}

export type ReviewRecord = ReviewSelection & {
  id: string
  status: ReviewStatus
  reason: string
  timestamp: string
}

type ReviewFormProps = {
  selected: ReviewSelection
  onSave: (record: ReviewRecord) => void
}

function ReviewForm({ selected, onSave }: ReviewFormProps) {
  const statusId = useId()
  const reasonId = useId()
  const reasonInput = useRef<HTMLTextAreaElement>(null)
  const [status, setStatus] = useState<ReviewStatus>('approved')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [reasonMissing, setReasonMissing] = useState(false)
  const reasonRequired = status !== 'approved' || selected.isEdited === true

  function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reasonRequired && !reason.trim()) {
      setReasonMissing(true)
      reasonInput.current?.focus()
      return
    }

    const now = new Date()
    onSave({
      ...selected,
      id: globalThis.crypto?.randomUUID?.() ?? `${now.getTime()}-${Math.random().toString(36).slice(2)}`,
      status,
      reason: reason.trim(),
      timestamp: now.toISOString(),
    })
    setStatus('approved')
    setReason('')
    setReasonMissing(false)
    setMessage('검수 기록을 저장했습니다.')
  }

  return (
    <>
      <blockquote className="review-selected">
        <div className="review-meta">
          <strong>{selected.branchName}</strong>
          <span>{selected.sectionLabel}</span>
        </div>
        <p>{selected.text}</p>
      </blockquote>
      <form className="review-form" onSubmit={saveReview} noValidate>
        <div className="review-field">
          <label htmlFor={statusId}>검수 결과</label>
          <select
            id={statusId}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ReviewStatus)
              setReasonMissing(false)
              setMessage('')
            }}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="review-field">
          <label htmlFor={reasonId}>수정 사유 {reasonRequired ? '(필수)' : '(선택)'}</label>
          <textarea
            id={reasonId}
            ref={reasonInput}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setReasonMissing(false)
              setMessage('')
            }}
            rows={4}
            required={reasonRequired}
            aria-invalid={reasonMissing}
            aria-describedby={reasonMissing ? `${reasonId}-error` : undefined}
            placeholder="수정한 이유 또는 검수 의견을 입력하세요."
          />
          {reasonMissing && <p id={`${reasonId}-error`} className="review-error" role="alert">수정 사유를 입력해 주세요.</p>}
        </div>
        <div className="review-actions">
          <button className="review-save" type="submit"><Save size={16} aria-hidden="true" /> 검수 기록 저장</button>
          {message && <span className="review-success" role="status">{message}</span>}
        </div>
      </form>
    </>
  )
}

type ReviewHistoryProps = {
  selected: ReviewSelection | null
  records: ReviewRecord[]
  onSave: (record: ReviewRecord) => void
}

export function ReviewHistory({ selected, records, onSave }: ReviewHistoryProps) {
  return (
    <div className="review-grid">
      <section className="review-card">
        <h2 className="review-title"><ClipboardCheck size={20} aria-hidden="true" /> 문구 검수</h2>
        {selected?.text.trim() ? (
          <ReviewForm
            key={selected.candidateId ?? `${selected.branchName}-${selected.sectionLabel}`}
            selected={selected}
            onSave={onSave}
          />
        ) : (
          <p className="review-empty">생성 작업에서 문구를 선택하면 검수 결과를 기록할 수 있습니다.</p>
        )}
      </section>
      <section className="review-card">
        <h2 className="review-title"><History size={20} aria-hidden="true" /> 저장된 기록</h2>
        {records.length ? (
          <ul className="review-list">
            {records.map((record) => (
              <li key={record.id} className="review-record">
                <div className="review-record-header">
                  <span className={`review-status review-status--${record.status}`}>{statusLabels[record.status]}</span>
                  <time dateTime={record.timestamp}>{reviewDate.format(new Date(record.timestamp))}</time>
                </div>
                <div className="review-meta">
                  <strong>{record.branchName}</strong>
                  <span>{record.sectionLabel}</span>
                </div>
                <p className="review-record-text">{record.text}</p>
                {record.reason && (
                  <div className="review-reason">
                    <strong>수정 사유</strong>
                    <p>{record.reason}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="review-empty">저장된 검수 기록이 없습니다.</p>
        )}
      </section>
    </div>
  )
}
