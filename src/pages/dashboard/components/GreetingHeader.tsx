// bal24 v2 — 홈 인사말 헤더 (V7 HomeV9 인사말 카드 차용 + V2 디자인 토큰 적용)
// 오늘 날짜 + 사용자명 + 아이콘. AI 브리핑은 /ai 메뉴로 이동시킴.

import { Sparkles } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

function todayKo(): string {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function deriveDisplayName(email: string | null | undefined): string {
  if (!email) return '관리자';
  const local = email.split('@')[0] ?? email;
  return local.length > 0 ? local : '관리자';
}

export default function GreetingHeader() {
  const { user } = useAuth();
  const metaName = (user?.user_metadata?.name ?? '') as string;
  const displayName = metaName.trim() || deriveDisplayName(user?.email ?? null);

  return (
    <section
      className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]"
      aria-label="인사말"
    >
      <div className="flex items-start gap-4">
        <span
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-[0_2px_8px_rgba(124,58,237,0.08)]"
          aria-hidden="true"
        >
          <Sparkles size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {todayKo()}
          </p>
          <h2 className="mt-1 text-lg font-bold text-[#1E1B4B] truncate">
            안녕하세요, <span className="text-violet-600">{displayName}</span> 님 👋
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            오늘의 진행 현황을 한눈에 확인해 보세요.
          </p>
        </div>
      </div>
    </section>
  );
}
