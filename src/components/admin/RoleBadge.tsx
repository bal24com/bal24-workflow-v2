// 역할 배지 컴포넌트 — 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28)
// 박경수님 환경 6종 role: admin / pm / staff / finance / partner / member

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 border-violet-200',
  pm: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  staff: 'bg-blue-50 text-blue-700 border-blue-200',
  partner: 'bg-amber-50 text-amber-700 border-amber-200',
  member: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  pm: 'PM',
  finance: '재무',
  staff: '운영',
  partner: '컨소시엄',
  member: '팀원',
};

export default function RoleBadge({ role }: { role: string | null | undefined }) {
  const key = (role ?? 'member').toLowerCase();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${ROLE_STYLES[key] ?? ROLE_STYLES.member}`}>
      {ROLE_LABELS[key] ?? key}
    </span>
  );
}
