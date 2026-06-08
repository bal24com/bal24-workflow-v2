// 동아리 일괄 등록 — 붙여넣은 표 텍스트를 AI 가 의미 기반으로 분석해 구조화.
// 컬럼 순서·헤더 유무에 상관없이 학교명·팀명·지도교사 등을 추론. 명시 클릭 시만 호출.

import { callAi } from '../../../../lib/aiClient';

export interface AiParsedClub {
  school_name: string;
  club_name: string;
  teacher_name: string;
  teacher_phone: string;
  student_count: number | null;
  club_type: string;
  operating_method: string;
  valid: boolean;
  error?: string;
}

const AI_SYSTEM = `당신은 한국어 표 데이터 분석가입니다.
붙여넣은 표(엑셀에서 복사된 탭/공백 구분 텍스트)를 분석해 동아리(팀) 목록을 JSON 으로만 반환합니다.
인사·설명·주석은 절대 출력하지 않습니다.`;

const AI_PROMPT = `아래는 학교 동아리(참여팀) 명단을 엑셀에서 복사한 표입니다.
컬럼 순서가 자료마다 다를 수 있으니, 머리글과 값의 의미를 보고 각 항목을 추론하세요.
헤더 행(연번·학교명·팀명 같은 제목 줄)은 데이터에서 제외하세요.

다음 JSON 배열 형태로만 반환하세요.

{
  "clubs": [
    {
      "school_name": "학교명 (예: 매성고, 호남원예고)",
      "club_name": "동아리명 또는 팀명 (예: Pear Ricotta LAB, 슈가메론)",
      "teacher_name": "지도교사 이름 (없으면 빈 문자열)",
      "teacher_phone": "연락처 (없으면 빈 문자열)",
      "student_count": 팀원수 숫자 (없으면 null),
      "club_type": "참여방법/구분 (예: 멘토링, 집중교육 — 없으면 빈 문자열)",
      "operating_method": "초기 아이디어/운영방법 등 비고 (없으면 빈 문자열)"
    }
  ]
}

판단 규칙.
- 학교명은 "OO고/OO중/OO고등학교/OO예고" 처럼 학교 이름이 들어간 열입니다.
- 팀명(동아리명)은 영문·창의적 명칭이 섞인 고유 이름 열입니다 (예: "스마트Farm업", "달콤공방 따따").
- "고등학교/중학교" 같은 학교급, "멘토링/집중교육" 같은 참여방법을 학교명·팀명으로 착각하지 마세요.
- 숫자만 있는 "연번" 열은 무시하세요.
- 지도교사 칸에 숫자만 있으면 그것은 팀원수일 가능성이 높으니 teacher_name 은 비우고 student_count 로 옮기세요.
- 연락처는 010-xxxx-xxxx 형태 전화번호입니다.

학교명과 팀명을 둘 다 못 찾은 행은 배열에서 제외하세요.
JSON 외 텍스트 금지. 마크다운 코드블록(\`\`\`) 금지. 순수 JSON 만 출력.`;

function extractJsonString(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) return t.slice(first, last + 1);
  return t;
}

interface RawClub {
  school_name?: unknown;
  club_name?: unknown;
  teacher_name?: unknown;
  teacher_phone?: unknown;
  student_count?: unknown;
  club_type?: unknown;
  operating_method?: unknown;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && v.trim() !== '' ? n : null;
  }
  return null;
}

function normalize(raw: RawClub): AiParsedClub {
  const school = str(raw.school_name);
  const club = str(raw.club_name);
  const valid = school.length > 0 && club.length > 0;
  return {
    school_name: school,
    club_name: club,
    teacher_name: str(raw.teacher_name),
    teacher_phone: str(raw.teacher_phone),
    student_count: numOrNull(raw.student_count),
    club_type: str(raw.club_type),
    operating_method: str(raw.operating_method),
    valid,
    error: valid ? undefined : '학교명·팀명 인식 실패',
  };
}

/** 붙여넣은 표 텍스트 → AI → 동아리 목록. 실패 시 throw. */
export async function importClubsFromText(rawText: string): Promise<AiParsedClub[]> {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error('분석할 내용이 없어요.');

  const res = await callAi({
    preset: 'curriculum-extract',
    systemOverride: AI_SYSTEM,
    messages: [{ role: 'user', content: `${AI_PROMPT}\n\n[표 데이터]\n${trimmed}` }],
    maxTokens: 4096,
  });

  if (!res.ok || !res.text) {
    throw new Error(res.errorMessage ?? 'AI 응답이 비어 있어요.');
  }

  let parsed: { clubs?: unknown };
  try {
    parsed = JSON.parse(extractJsonString(res.text)) as { clubs?: unknown };
  } catch (err) {
    console.error('[clubAiImport] JSON 파싱 실패:', err, 'raw:', res.text.slice(0, 300));
    throw new Error('AI 응답을 동아리 목록으로 해석하지 못했어요. 다시 시도해 주세요.');
  }

  const list = Array.isArray(parsed.clubs) ? parsed.clubs : [];
  const clubs = list.map((c) => normalize(c as RawClub)).filter((c) => c.school_name || c.club_name);

  if (clubs.length === 0) {
    throw new Error('AI 가 동아리를 1개도 추출하지 못했어요. 표 내용을 확인해 주세요.');
  }

  return clubs;
}
