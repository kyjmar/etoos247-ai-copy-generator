import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import {
  Building2, Check, ChevronDown, ClipboardList, Copy, FileText, History, Info, LayoutGrid, ListFilter,
  LoaderCircle, Pencil, Plus, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import {
  checkCopy, DEFAULT_BRANCH, DEFAULT_GUIDE, generateSample, sampleGenerator, SECTIONS, SECTION_IDS, TONES,
} from './generator'
import type { BrandGuide, GenerationRequest, GenerationResult, SectionId, Tone } from './generator'
import { ReviewHistory } from './ReviewHistory'
import type { ReviewRecord, ReviewSelection } from './ReviewHistory'

const AREA_DESCRIPTIONS: Record<SectionId, string> = {
  hero: '페이지 상단',
  strengths: '지점 특장점',
  audience: '학생 유형',
}
const STORAGE_KEY = 'etoos247-copy-review-v1'
const initialRequest: GenerationRequest = {
  branch: DEFAULT_BRANCH,
  guide: DEFAULT_GUIDE,
  sections: [...SECTION_IDS],
}

function readReviews(): ReviewRecord[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="section-heading">
      <span className="section-icon">{icon}</span>
      <h2>{children}</h2>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<'generator' | 'history'>('generator')
  const [branchName, setBranchName] = useState(DEFAULT_BRANCH.branchName)
  const [keywords, setKeywords] = useState(DEFAULT_BRANCH.keywords)
  const [keywordDraft, setKeywordDraft] = useState('')
  const [evidence, setEvidence] = useState(DEFAULT_BRANCH.evidence)
  const [sections, setSections] = useState<SectionId[]>([...SECTION_IDS])
  const [tone, setTone] = useState<Tone>(DEFAULT_GUIDE.tone)
  const [minChars, setMinChars] = useState(String(DEFAULT_GUIDE.minChars))
  const [maxChars, setMaxChars] = useState(String(DEFAULT_GUIDE.maxChars))
  const [bannedPhrases, setBannedPhrases] = useState(DEFAULT_GUIDE.bannedPhrases.join(', '))
  const [guideOpen, setGuideOpen] = useState(false)
  const [request, setRequest] = useState(initialRequest)
  const [results, setResults] = useState<GenerationResult>(() => generateSample(initialRequest))
  const [activeSection, setActiveSection] = useState<SectionId>('hero')
  const [selected, setSelected] = useState<Partial<Record<SectionId, { id: string; text: string }>>>({})
  const [reviewTarget, setReviewTarget] = useState<SectionId | null>(null)
  const [reviews, setReviews] = useState(readReviews)
  const [storageError, setStorageError] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copyNotice, setCopyNotice] = useState<{ id: string; message: string } | null>(null)
  const copyTimer = useRef<number | undefined>(undefined)
  const keywordsInput = useRef<HTMLInputElement>(null)
  const tabs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({})

  function mergedKeywords() {
    return [...new Set([...keywords, ...keywordDraft.split(',').map(item => item.trim()).filter(Boolean)])]
  }

  function addKeyword() {
    setKeywords(mergedKeywords())
    setKeywordDraft('')
    keywordsInput.current?.focus()
  }

  function handleKeywordKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === ',')) {
      event.preventDefault()
      addKeyword()
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const branch = branchName.trim()
    const strengthKeywords = mergedKeywords()
    if (!branch || !strengthKeywords.length || !sections.length) {
      setFormMessage('지점명과 강점 키워드를 입력하고 생성 영역을 하나 이상 선택해 주세요.')
      return
    }
    const min = Number(minChars)
    const max = Number(maxChars)
    if (!minChars.trim() || !maxChars.trim() || !Number.isInteger(min) || !Number.isInteger(max)
      || min < 1 || max > 300 || min > max) {
      setGuideOpen(true)
      setFormMessage('글자 수는 1~300 사이의 정수로 입력하고, 최소값이 최대값을 넘지 않게 설정해 주세요.')
      return
    }
    const guide: BrandGuide = {
      tone,
      minChars: min,
      maxChars: max,
      bannedPhrases: bannedPhrases.split(/[,\n]/).map(phrase => phrase.trim()).filter(Boolean),
    }
    const next: GenerationRequest = {
      branch: { branchName: branch, keywords: strengthKeywords, evidence: evidence.trim() },
      guide,
      sections: SECTION_IDS.filter(section => sections.includes(section)),
    }
    setFormMessage('')
    setIsGenerating(true)
    try {
      const generated = await sampleGenerator.generate(next)
      setRequest(next)
      setResults(generated)
      setActiveSection(current => next.sections.includes(current) ? current : next.sections[0])
      setKeywords(strengthKeywords)
      setKeywordDraft('')
      setSelected({})
      setReviewTarget(null)
      setCopyNotice(null)
    } catch {
      setFormMessage('문구를 생성할 수 없습니다. 다시 시도해 주세요.')
    } finally {
      setIsGenerating(false)
    }
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    const current = request.sections.indexOf(activeSection)
    let next: number
    switch (event.key) {
      case 'ArrowRight': next = (current + 1) % request.sections.length; break
      case 'ArrowLeft': next = (current + request.sections.length - 1) % request.sections.length; break
      case 'Home': next = 0; break
      case 'End': next = request.sections.length - 1; break
      default: return
    }
    event.preventDefault()
    const section = request.sections[next]
    setActiveSection(section)
    tabs.current[section]?.focus()
  }

  async function copyText(id: string, text: string) {
    if (!text.trim()) return
    let message = '클립보드에 복사했습니다.'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const field = document.createElement('textarea')
      field.value = text
      field.style.cssText = 'position:fixed;left:-9999px;top:0'
      const previouslyFocused = document.activeElement
      document.body.append(field)
      field.select()
      try {
        if (!document.execCommand('copy')) throw new Error('Copy unavailable')
      } catch {
        message = '복사할 수 없습니다. 문구를 선택해 직접 복사해 주세요.'
      } finally {
        field.remove()
        if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
      }
    }
    setCopyNotice({ id, message })
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyNotice(null), 3500)
  }

  function saveReview(record: ReviewRecord) {
    const next = [record, ...reviews]
    setReviews(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError('이 브라우저에 기록을 저장할 수 없습니다. 현재 화면에서만 기록을 확인할 수 있습니다.')
    }
  }

  const target = reviewTarget ? selected[reviewTarget] : undefined
  const reviewSelection: ReviewSelection | null = reviewTarget && target?.text.trim() ? {
    candidateId: target.id,
    branchName: request.branch.branchName,
    sectionLabel: SECTIONS[reviewTarget].title,
    text: target.text.trim(),
    isEdited: results[reviewTarget]?.find(candidate => candidate.id === target.id)?.text !== target.text.trim(),
  } : null
  const candidates = results[activeSection] ?? []

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="header-brand">
            <a className="wordmark" href="./" aria-label="이투스247학원 홈" onClick={event => { event.preventDefault(); setPage('generator') }}>
              <span>이투스</span><strong>247</strong><span>학원</span>
            </a>
            <span className="header-divider" />
            <span className="team-name">가맹마케팅지원팀</span>
          </div>
          <nav className="main-nav" aria-label="주 메뉴">
            <button type="button" aria-current={page === 'generator' ? 'page' : undefined} onClick={() => setPage('generator')}>
              <FileText size={17} /> 문구 생성
            </button>
            <button type="button" aria-current={page === 'history' ? 'page' : undefined} onClick={() => setPage('history')}>
              <History size={17} /> 검수 기록
            </button>
          </nav>
          <span className="header-mode"><span className="mode-dot" /> 프로토타입</span>
        </div>
      </header>

      <main className="workspace">
        <div className="page-intro">
          <h1>{page === 'generator' ? '학원소개 AI 문구 생성' : '검수 기록'}</h1>
          <p>{page === 'generator'
            ? '지점의 강점을 입력하고 브랜드 기준에 맞는 학원소개 문구를 만들어 보세요.'
            : '선택한 문구의 검수 결과와 수정 사유를 기록하고 이력을 확인하세요.'}</p>
        </div>

        {page === 'history' ? (
          <>
            {storageError && <p className="form-error" role="alert">{storageError}</p>}
            <ReviewHistory selected={reviewSelection} records={reviews} onSave={saveReview} />
          </>
        ) : (
          <div className="workspace-grid">
            <form className="input-stack" onSubmit={generate}>
              <section className="surface info-panel">
                <SectionHeading icon={<Building2 size={18} />}>지점 정보</SectionHeading>
                <div className="branch-fields">
                  <div className="field">
                    <label htmlFor="branch">지점명 <span className="required">*</span></label>
                    <input id="branch" value={branchName} onChange={event => setBranchName(event.target.value)} placeholder="예: 분당정자점" maxLength={40} aria-required="true" />
                  </div>
                  <div className="field">
                    <label htmlFor="keywords">강점 키워드 <span className="required">*</span></label>
                    <div className="keyword-box">
                      {keywords.map(keyword => (
                        <span className="keyword" key={keyword}>
                          {keyword}
                          <button type="button" aria-label={keyword + ' 삭제'} onClick={() => setKeywords(items => items.filter(item => item !== keyword))}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <div className="keyword-entry">
                        <input id="keywords" ref={keywordsInput} value={keywordDraft} onKeyDown={handleKeywordKey} onChange={event => setKeywordDraft(event.target.value)} placeholder="키워드 추가" />
                        <button type="button" title="키워드 추가" aria-label="키워드 추가" onClick={addKeyword}><Plus size={15} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="evidence">근거 자료 <span className="optional">선택</span></label>
                    <textarea id="evidence" value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="실제 운영 사례, 학습 관리 방식 등을 입력해 주세요." maxLength={1000} rows={2} />
                    <small>확인 가능한 운영 사례나 데이터를 입력해 주세요.</small>
                  </div>
                </div>
              </section>

              <section className="surface area-panel">
                <SectionHeading icon={<LayoutGrid size={18} />}>생성 영역</SectionHeading>
                <div className="area-options">
                  {SECTION_IDS.map(section => (
                    <label key={section} className={'area-option' + (sections.includes(section) ? ' area-checked' : '')}>
                      <input type="checkbox" checked={sections.includes(section)} onChange={() => setSections(previous => previous.includes(section) ? previous.filter(item => item !== section) : [...previous, section])} />
                      <span className="check-square" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
                      <span className="area-label"><strong>{SECTIONS[section].title}</strong><small>{AREA_DESCRIPTIONS[section]}</small></span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="surface guide-panel">
                <button className="guide-toggle" type="button" aria-expanded={guideOpen} aria-controls="guide-fields" onClick={() => setGuideOpen(open => !open)}>
                  <span className="section-icon"><ListFilter size={18} /></span>
                  <span className="guide-label">브랜드 가이드 <small>문체 · 글자 수 · 금지 표현</small></span>
                  <ChevronDown className={guideOpen ? 'chevron expanded' : 'chevron'} size={18} />
                </button>
                {guideOpen && (
                  <div className="guide-fields" id="guide-fields">
                    <div className="field">
                      <label htmlFor="tone">문체</label>
                      <select id="tone" value={tone} onChange={event => setTone(event.target.value as Tone)}>
                        {TONES.map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div className="guide-length">
                      <div className="field"><label htmlFor="min-chars">최소 글자 수</label><input id="min-chars" inputMode="numeric" value={minChars} onChange={event => setMinChars(event.target.value)} /></div>
                      <div className="field"><label htmlFor="max-chars">최대 글자 수</label><input id="max-chars" inputMode="numeric" value={maxChars} onChange={event => setMaxChars(event.target.value)} /></div>
                    </div>
                    <div className="field">
                      <label htmlFor="banned">금지 표현</label>
                      <textarea id="banned" rows={2} value={bannedPhrases} onChange={event => setBannedPhrases(event.target.value)} />
                      <small>여러 표현은 쉼표로 구분해 주세요.</small>
                    </div>
                  </div>
                )}
              </section>
              {formMessage && <p className="form-error" role="alert">{formMessage}</p>}
              <button className="generate-button" type="submit" disabled={isGenerating}>
                {isGenerating ? <LoaderCircle className="spinning" size={18} /> : <Sparkles size={18} />}
                {isGenerating ? '생성 중…' : '샘플 문구 생성'}
              </button>
            </form>

            <section className="surface results-panel" aria-label="생성 결과" aria-busy={isGenerating}>
              <div className="results-heading">
                <SectionHeading icon={<Sparkles size={18} />}>생성 결과</SectionHeading>
                <span className="result-branch"><Building2 size={14} /> {request.branch.branchName}</span>
              </div>
              <div className="sample-banner">
                <Info size={17} />
                <p><strong>샘플 결과</strong><span>템플릿 기반 예시 문구입니다. AI 모델은 연결되어 있지 않습니다.</span></p>
              </div>
              <div className="results-tabs" role="tablist" aria-label="결과 영역">
                {request.sections.map(section => (
                  <button type="button" key={section} id={'tab-' + section} ref={node => { tabs.current[section] = node }}
                    role="tab" aria-selected={activeSection === section} aria-controls="candidate-panel"
                    tabIndex={activeSection === section ? 0 : -1} onKeyDown={moveTab}
                    onClick={() => setActiveSection(section)}>
                    {SECTIONS[section].title}{activeSection === section && <span className="tab-count">{candidates.length}</span>}
                  </button>
                ))}
              </div>

              <div id="candidate-panel" role="tabpanel" aria-labelledby={'tab-' + activeSection} className="candidate-panel">
                <div className="candidate-intro"><p>문구 후보 <strong>{candidates.length}개</strong></p><span>공백 포함</span></div>
                <div className="candidate-list">
                  {candidates.map((candidate, index) => {
                    const editing = selected[activeSection]?.id === candidate.id
                    const content = editing ? selected[activeSection]!.text : candidate.text
                    const checks = checkCopy(content, request.guide)
                    const suffix = String(index + 1).padStart(2, '0')
                    return (
                      <article className={'candidate-card' + (editing ? ' candidate-selected' : '')} key={candidate.id}>
                        <div className="candidate-meta">
                          <span className="candidate-number">후보 {suffix}</span>
                          <span className="char-count">{checks.characterCount}자</span>
                        </div>
                        {editing ? (
                          <div className="edit-box">
                            <label htmlFor={'edit-' + candidate.id}><Pencil size={14} /> 문구 편집</label>
                            <textarea id={'edit-' + candidate.id} rows={3} value={content}
                              onChange={event => setSelected(previous => ({ ...previous, [activeSection]: { id: candidate.id, text: event.target.value } }))} />
                          </div>
                        ) : <p className="candidate-copy">{content}</p>}
                        {checks.issues.length > 0 && <ul className="candidate-issues">{checks.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
                        <div className="candidate-actions">
                          {copyNotice?.id === candidate.id && <span className="copy-notice" role="status">{copyNotice.message}</span>}
                          <button className="action-button" type="button" disabled={!content.trim()} aria-label={'후보 ' + suffix + ' 복사'} onClick={() => void copyText(candidate.id, content)}>
                            <Copy size={14} /> 복사
                          </button>
                          {editing ? (
                            <button className="action-button choose-button" type="button" disabled={!content.trim()} onClick={() => { setReviewTarget(activeSection); setPage('history'); window.scrollTo(0, 0) }}>
                              <ClipboardList size={15} /> 검수 기록
                            </button>
                          ) : (
                            <button className="action-button choose-button" type="button" aria-label={'후보 ' + suffix + ' 선택'} onClick={() => {
                              setSelected(previous => ({ ...previous, [activeSection]: { id: candidate.id, text: candidate.text } }))
                              setReviewTarget(activeSection)
                            }}>
                              <Check size={15} /> 선택
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
              <div className="results-footnote"><ShieldCheck size={15} /> 게시 전 지점 정보와 브랜드 기준을 검수해 주세요.</div>
            </section>
          </div>
        )}
        <footer className="workspace-footer">이투스247학원 <span /> 가맹마케팅지원팀</footer>
      </main>
    </>
  )
}
