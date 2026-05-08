// bal24 v2 — AI 어시스턴트 유틸 (STEP 21 → STEP-AI-PREP)
// callAi('chat') Edge Function 호출 + Mock fallback + 시스템 프롬프트 + 빠른 프롬프트 템플릿

export type AiRole = 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiConversationRow {
  id: string;
  user_id: string;
  title: string;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessageRow {
  id: string;
  conversation_id: string;
  role: AiRole;
  content: string;
  created_at: string;
}

export const SYSTEM_PROMPT = `
당신은 BalanceDot WorkFlow의 AI 어시스턴트입니다.
교육 사업 운영, 프로젝트 관리, 재무 정산, 강사 섭외, 고객 관리 등
업무 전반에 걸쳐 전문적인 도움을 드립니다.
답변은 항상 한국어로 작성하며, 실무에 바로 활용할 수 있도록
구체적이고 간결하게 작성합니다.
`.trim();

export interface PromptTemplate {
  label: string;
  text: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: '📋 결과보고서 초안',
    text: '교육 프로그램 결과보고서 초안을 작성해줘. 프로그램명, 기간, 참여자 수를 알려주면 작성해드릴게요.',
  },
  {
    label: '📧 강사 섭외 메일',
    text: '강사 섭외 이메일 초안을 작성해줘. 강의 주제와 일시를 알려주면 작성해드릴게요.',
  },
  {
    label: '💰 예산 계획 정리',
    text: '사업 예산 계획서 양식을 만들어줘. 항목별로 정리된 표 형태로 작성해드릴게요.',
  },
  {
    label: '📊 주간 업무 보고',
    text: '이번 주 업무 보고서 양식을 작성해줘. 주요 성과, 이슈, 다음 주 계획 포함.',
  },
  {
    label: '🤝 제안서 개요',
    text: '신규 교육 사업 제안서 개요를 작성해줘. 사업명과 목적을 알려주면 작성해드릴게요.',
  },
  {
    label: '📅 일정 공문 작성',
    text: '교육 일정 안내 공문을 작성해줘. 대상 기관, 일시, 장소를 알려주면 작성해드릴게요.',
  },
];

const MAX_HISTORY = 10;

/**
 * STEP-AI-PREP — callAi('chat') Edge Function 호출.
 * Edge Function 배포 전에는 Mock fallback (박경수님 deploy 후 자동 실제 전환).
 */
export async function sendToAi(
  messages: AiMessage[],
  systemPrompt: string = SYSTEM_PROMPT,
): Promise<{ content: string; mock: boolean }> {
  // 토큰 절약: 최근 N개만 전송
  const trimmed = messages.slice(-MAX_HISTORY);

  // 동적 import — aiClient는 lazy load (Mock fallback 없는 환경에서도 동작)
  const { callAi } = await import('../../lib/aiClient');
  const res = await callAi({
    preset: 'chat',
    systemOverride: systemPrompt,
    messages: trimmed,
    maxTokens: 2048,
  });

  if (res.ok && res.text) {
    return { content: res.text, mock: false };
  }

  // 실제 호출 실패 (Edge 미배포·인증·rate limit 등) → Mock fallback
  console.error('[ai] callAi 실패 → Mock fallback:', res.errorMessage);
  await new Promise((r) => setTimeout(r, 400));
  const last = trimmed[trimmed.length - 1];
  const userText = last?.content ?? '';
  return {
    content: buildMockReply(userText, res.errorMessage),
    mock: true,
  };
}

function buildMockReply(userText: string, errorMessage?: string): string {
  const trimmed = userText.trim();
  const head = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
  const reasonLine = errorMessage ? `\n사유: ${errorMessage}\n` : '';
  return [
    `[Mock 모드] "${head}"에 대한 임시 응답이에요.${reasonLine}`,
    'Edge Function `ai-chat`이 아직 배포되지 않았거나 호출에 실패했어요.',
    'Supabase Dashboard에서 다음을 확인해 주세요:',
    '1. Edge Functions → `ai-chat` 배포 (`supabase functions deploy ai-chat`)',
    '2. Secrets → `ANTHROPIC_API_KEY` 등록',
    '3. (선택) 일일 호출 한도 / billing limit',
  ].join('\n');
}

/** 대화 제목 자동 생성 (첫 user 메시지 앞 20자) */
export function generateTitle(firstMessage: string): string {
  const v = firstMessage.trim();
  if (v.length === 0) return '새 대화';
  return v.length > 20 ? `${v.slice(0, 20)}…` : v;
}

/** 메시지 시간 표기 (오늘 HH:MM / 그 전 MM월 DD일) */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 대화 목록 그룹 라벨 (오늘/어제/이전) */
export function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '이전';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDay = Math.floor((today - target) / 86400000);
  if (diffDay === 0) return '오늘';
  if (diffDay === 1) return '어제';
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
