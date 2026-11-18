export const SECTION_IDS = ['hero', 'strengths', 'audience'] as const
export type SectionId = (typeof SECTION_IDS)[number]

export const SECTIONS: Record<SectionId, { title: string; description: string }> = {
  hero: { title: '대표 문구', description: '페이지 상단에서 지점의 첫인상을 전하는 문구' },
  strengths: { title: '지점 강점', description: '지점의 학습 관리 방식과 운영 강점을 소개하는 문구' },
  audience: { title: '추천 대상', description: '지점의 학습 방식이 맞는 학생을 안내하는 문구' },
}

export const TONES = ['신뢰감 있는', '친근한', '간결한'] as const
export type Tone = (typeof TONES)[number]

export interface BranchInput {
  branchName: string
  keywords: string[]
  evidence: string
}

export interface BrandGuide {
  tone: Tone
  minChars: number
  maxChars: number
  bannedPhrases: string[]
}

export interface GenerationRequest {
  branch: BranchInput
  guide: BrandGuide
  sections: SectionId[]
}

export interface Candidate {
  id: string
  text: string
}

export type GenerationResult = Partial<Record<SectionId, Candidate[]>>

export interface CopyGenerator {
  generate(request: GenerationRequest): Promise<GenerationResult>
}

export const DEFAULT_BRANCH: BranchInput = {
  branchName: '분당정자점',
  keywords: ['1:1 학습 코칭', '자기주도학습', '맞춤형 학습 관리'],
  evidence: '매주 1:1 학습 상담을 진행하고 월간 학습 리포트로 학습 진행 상황을 점검합니다.',
}

export const DEFAULT_GUIDE: BrandGuide = {
  tone: '신뢰감 있는',
  minChars: 40,
  maxChars: 100,
  bannedPhrases: ['합격 보장', '성적 향상 보장', '최고', '무조건'],
}

function normalizePhrase(text: string) {
  return text.trim().normalize('NFKC').toLocaleLowerCase('ko-KR')
}

function findBannedPhrases(text: string, phrases: string[]) {
  const normalizedText = normalizePhrase(text)
  return phrases.filter((phrase) => {
    const normalizedPhrase = normalizePhrase(phrase)
    return normalizedPhrase && normalizedText.includes(normalizedPhrase)
  })
}

export function checkCopy(text: string, guide: BrandGuide) {
  const characterCount = Array.from(text.trim().normalize('NFC')).length
  const issues: string[] = []
  if (characterCount < guide.minChars || characterCount > guide.maxChars) {
    issues.push(`${guide.minChars}~${guide.maxChars}자로 작성해 주세요. 현재 ${characterCount}자입니다.`)
  }
  for (const phrase of findBannedPhrases(text, guide.bannedPhrases)) {
    issues.push(`금지 표현 ‘${phrase}’이 포함되어 있습니다.`)
  }
  return { characterCount, issues }
}

function getDetails(branch: BranchInput, guide: BrandGuide) {
  const clean = (text: string) => text.replace(/\s+/gu, ' ').trim()
  const allowed = (text: string) => text && !findBannedPhrases(text, guide.bannedPhrases).length
  const name = clean(branch.branchName)
  const keywords = branch.keywords.map(clean).filter(allowed)
  const evidence = branch.evidence.trim().split(/\n+|(?<=[.!?。！？])\s+/u)
    .map(clean)
    .filter(allowed)[0]

  return {
    name: allowed(name) ? name : '이투스247학원',
    first: keywords[0] ?? '학습 계획 점검',
    second: keywords[1] ?? '자기주도학습',
    third: keywords[2] ?? keywords[0] ?? '학습 관리',
    evidence: evidence ? ensureSentence(evidence) : '',
  }
}

function ensureSentence(text: string) {
  return /[.!?。！？]$/u.test(text) ? text : `${text}.`
}

function withParticle(text: string, afterConsonant: string, afterVowel: string) {
  const last = text.charCodeAt(text.length - 1)
  const finalConsonant = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0
  const isRieulException = afterVowel === '로' && finalConsonant === 8
  return text + (finalConsonant && !isRieulException ? afterConsonant : afterVowel)
}

function getDrafts(section: SectionId, branch: BranchInput, guide: BrandGuide): string[] {
  const { name, first, second, third, evidence } = getDetails(branch, guide)
  const byFirst = withParticle(first, '으로', '로')
  const byThird = withParticle(third, '으로', '로')
  const nameTopic = withParticle(name, '은', '는')
  const thirdTopic = withParticle(third, '은', '는')
  const nameObject = withParticle(name, '을', '를')
  const secondObject = withParticle(second, '을', '를')
  const thirdObject = withParticle(third, '을', '를')
  const thirdSubject = withParticle(third, '이', '가')
  const toneOptions: Record<Tone, Record<SectionId, string[]>> = {
    '신뢰감 있는': {
      hero: [
        `계획을 실천으로 이어가는 학습, ${name}. ${byFirst} 나에게 맞는 학습 방향을 찾아보세요.`,
        `스스로 공부하는 힘을 기르는 곳, ${name}. ${second}에 집중하며 나만의 학습 흐름을 만들어 보세요.`,
        `오늘의 학습부터 다음 계획까지. ${name}에서 ${thirdObject} 바탕으로 꾸준히 학습을 이어가세요.`,
      ],
      strengths: [
        `${name}의 ${byFirst} 학습 방향을 점검하고 다음 계획을 구체화할 수 있습니다.`,
        `${nameTopic} ${second}에 집중하며 자신의 학습 흐름을 점검할 수 있도록 돕습니다.`,
        `${name}의 ${thirdTopic} 학습 계획과 실천을 함께 돌아보는 데 초점을 둡니다.`,
      ],
      audience: [
        `공부 방향을 구체화하고 싶은 학생에게 권합니다. ${name}에서 ${byFirst} 학습 계획을 점검해 보세요.`,
        `스스로 세운 공부 계획을 꾸준히 실천하고 싶은 학생이라면 ${name}의 ${second} 방식을 살펴보세요.`,
        `공부량과 진도를 어떻게 관리할지 고민하는 학생에게 ${name}의 ${thirdObject} 추천합니다.`,
      ],
    },
    '친근한': {
      hero: [
        `공부를 어디서부터 시작할지 고민인가요? ${name}에서 ${byFirst} 나에게 맞는 방법을 함께 찾아봐요.`,
        `오늘 세운 계획을 차근차근 실천해 봐요. ${name}에서 ${second}에 집중해 보세요.`,
        `혼자 관리하기 어렵다면 ${name}에서 시작해 보세요. ${byThird} 공부의 흐름을 만들어 봐요.`,
      ],
      strengths: [
        `${name}에서는 ${byFirst} 지금의 공부 방법을 돌아보고 다음 계획을 세울 수 있어요.`,
        `${second}에 집중하고 싶다면 ${name}에서 내 공부 흐름부터 점검해 봐요.`,
        `${name}에서 ${thirdObject} 살펴보세요. 내 진도와 목표를 차근차근 정리할 수 있어요.`,
      ],
      audience: [
        `오늘 뭘 공부할지 자주 고민하나요? ${name}에서 ${byFirst} 공부 방향을 잡아 보세요.`,
        `계획을 꾸준히 실천하는 게 어렵다면 ${name}의 ${second} 방식이 잘 맞을 수 있어요.`,
        `내 진도에 맞춰 공부하고 싶나요? ${name}에서 ${thirdObject} 살펴보세요.`,
      ],
    },
    '간결한': {
      hero: [
        `${name}, ${first} 중심의 학습. 지금의 공부를 점검하고 다음 계획을 세웁니다.`,
        `공부의 흐름을 만드는 ${second}. ${name}에서 계획을 세우고 실천합니다.`,
        `${name}의 ${third}. 목표와 진도에 맞춰 학습 방향을 점검합니다.`,
      ],
      strengths: [
        `${name}의 ${first}. 학습 계획과 실천 과정을 함께 점검합니다.`,
        `${second}에 집중하는 ${name}. 스스로 세운 계획에 맞춰 학습합니다.`,
        `${name}의 ${third}. 학습 진도와 다음 계획을 함께 확인합니다.`,
      ],
      audience: [
        `학습 계획에 도움이 필요한 학생에게 ${name}의 ${first} 방식을 권합니다.`,
        `공부 습관을 스스로 만들고 싶은 학생에게 ${second} 중심의 ${nameObject} 추천합니다.`,
        `진도를 점검하며 공부하고 싶은 학생에게 ${name}의 ${thirdObject} 권합니다.`,
      ],
    },
  }

  const drafts = toneOptions[guide.tone][section]
  const shortOptions: Record<SectionId, string[]> = {
    hero: [`${name}에서 시작하는 ${first}`, `${second}에 집중하는 ${name}`, `공부의 흐름을 만드는 ${third}`],
    strengths: [`학습 방향을 살피는 ${first}`, `${name}의 ${second}`, `계획과 실천을 잇는 ${third}`],
    audience: [`${first}에 관심 있는 학생`, `${secondObject} 시작하고 싶은 학생`, `${thirdSubject} 필요한 학생`],
  }

  if (evidence) {
    const evidenceIntro: Record<Tone, Record<SectionId, string>> = {
      '신뢰감 있는': {
        hero: `학습 계획을 점검하는 ${name}.`,
        strengths: `${name}의 학습 지원을 소개합니다.`,
        audience: '학습 진행 상황을 점검하고 싶은 학생에게 권합니다.',
      },
      '친근한': {
        hero: `${name}에서 공부의 흐름을 함께 살펴봐요.`,
        strengths: `${name}의 학습 지원 방법을 살펴볼까요?`,
        audience: '내 공부가 어디까지 왔는지 궁금한가요?',
      },
      '간결한': {
        hero: `${name}의 학습 점검.`,
        strengths: `${name}의 학습 지원 방식입니다.`,
        audience: '학습 상황을 점검하려는 학생에게 권합니다.',
      },
    }
    drafts.splice(section === 'strengths' ? 0 : 2, 0, `${evidenceIntro[guide.tone][section]} ${evidence}`)
  }

  return [...drafts, ...shortOptions[section], ...drafts.map((draft) =>
    `${draft} 자세한 운영 방식은 지점에서 확인할 수 있습니다.`)]
}

export function generateSample(request: GenerationRequest): GenerationResult {
  const { branch, guide, sections } = request
  const result: GenerationResult = {}

  for (const section of sections) {
    const drafts = [...new Set(getDrafts(section, branch, guide))]
    const ranked = drafts.map((text) => ({
      text,
      bannedCount: findBannedPhrases(text, guide.bannedPhrases).length,
      length: checkCopy(text, guide).characterCount,
    })).sort((a, b) => {
      const distance = (length: number) => Math.max(guide.minChars - length, length - guide.maxChars, 0)
      return a.bannedCount - b.bannedCount || distance(a.length) - distance(b.length)
    })
    result[section] = ranked.slice(0, 3).map(({ text }, index) => ({
      id: `${section}-${index + 1}`,
      text,
    }))
  }
  return result
}

export const sampleGenerator: CopyGenerator = {
  async generate(request) {
    return generateSample(request)
  },
}
