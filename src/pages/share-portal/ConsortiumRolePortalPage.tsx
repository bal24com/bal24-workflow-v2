// 컨소시엄 역할별 외부 포털 화면 — 데이터는 보안 RPC(get_consortium_portal)로 받아 prop 으로 주입.
// 토큰 검증·역할별 필터는 서버(RPC)에서 처리하므로 여기선 렌더링만 담당.

import { Building2, CalendarDays, BookOpen, CheckSquare } from 'lucide-react';
import {
  SHARE_ROLE_LABEL,
  SHARE_ROLE_COLOR,
  type ShareRoleLinkType,
} from '../consortium/consortiumTypes';
import type { ConsortiumPortalData } from './sharePortalUtils';

const MEMBER_TYPE_LABEL: Record<string, string> = {
  lead: '주관사', co: '참여사', sub: '참여사', observer: '참관',
};

const TASK_STATUS_STYLE: Record<string, string> = {
  '인식': 'bg-slate-100 text-slate-600',
  '실행': 'bg-violet-100 text-violet-700',
  '검토': 'bg-orange-100 text-orange-700',
  '완료': 'bg-emerald-100 text-emerald-700',
};

function fmtDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
}

function fmtBudget(n: number | null): string {
  if (n === null) return '-';
  return n >= 100_000_000
    ? `${(n / 100_000_000).toFixed(1)}억원`
    : `${Math.round(n / 10_000).toLocaleString()}만원`;
}

interface Props {
  roleType: ShareRoleLinkType;
  data: ConsortiumPortalData;
}

export default function ConsortiumRolePortalPage({ roleType, data }: Props) {
  const { consortium, members, programs, tasks } = data;
  if (!consortium) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        컨소시엄 정보를 불러오지 못했어요.
      </div>
    );
  }

  // 서버(RPC)가 역할별로 빈 배열을 반환하므로 길이로 노출 여부 판단
  const showFinance = consortium.total_budget !== null;
  const taskDone = tasks.filter((t) => t.status === '완료').length;
  const taskPct = tasks.length > 0 ? Math.round((taskDone / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 rounded-2xl px-6 py-6 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2 ${SHARE_ROLE_COLOR[roleType]}`}>
                {SHARE_ROLE_LABEL[roleType]} 포털
              </span>
              <h1 className="text-xl font-bold text-white leading-tight">{consortium.name}</h1>
              {consortium.lead_client_name && (
                <p className="text-violet-200 text-xs mt-1">주관기관 · {consortium.lead_client_name}</p>
              )}
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-white/20 text-white shrink-0">
              {consortium.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-violet-200">
            {(consortium.start_date || consortium.end_date) && (
              <span className="flex items-center gap-1">
                <CalendarDays size={12} />
                {fmtDate(consortium.start_date)} ~ {fmtDate(consortium.end_date)}
              </span>
            )}
            {showFinance && consortium.total_budget && (
              <span className="flex items-center gap-1">
                총 예산 {fmtBudget(consortium.total_budget)}
              </span>
            )}
          </div>
        </div>

        {/* 안내 설명 */}
        {consortium.description && (
          <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {consortium.description}
          </div>
        )}

        {/* 참여기관 */}
        {members.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Building2 size={14} className="text-violet-600" />
              <h2 className="text-sm font-bold text-[#1E1B4B]">참여기관 ({members.length}곳)</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      {MEMBER_TYPE_LABEL[m.member_type] ?? m.member_type}
                    </span>
                    <span className="font-semibold text-[#1E1B4B]">{m.client_name ?? '-'}</span>
                  </div>
                  {showFinance && m.allocated_budget && (
                    <span className="text-xs text-slate-500 font-mono">{fmtBudget(m.allocated_budget)}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 프로그램 */}
        {programs.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <BookOpen size={14} className="text-violet-600" />
              <h2 className="text-sm font-bold text-[#1E1B4B]">프로그램 ({programs.length}건)</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {programs.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1E1B4B] truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {p.type} · {fmtDate(p.start_date)} ~ {fmtDate(p.end_date)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    p.status === '진행' ? 'bg-violet-100 text-violet-700' :
                    p.status === '완료' ? 'bg-emerald-100 text-emerald-700' :
                    p.status === '취소' ? 'bg-rose-100 text-rose-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 태스크 */}
        {tasks.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckSquare size={14} className="text-violet-600" />
                <h2 className="text-sm font-bold text-[#1E1B4B]">과업 진행현황</h2>
              </div>
              <span className="text-xs text-slate-500">{taskDone}/{tasks.length}건 완료 ({taskPct}%)</span>
            </div>
            <div className="px-5 py-3">
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-violet-500 h-2 rounded-full transition-all" style={{ width: `${taskPct}%` }} />
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-2.5 text-sm gap-3">
                  <p className="font-medium text-[#1E1B4B] truncate min-w-0">{t.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.due_date && (
                      <span className="text-[10px] text-slate-400 font-mono">{fmtDate(t.due_date)}</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TASK_STATUS_STYLE[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {programs.length === 0 && tasks.length === 0 && members.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-10 text-center text-slate-400 text-sm">
            아직 공유된 내용이 없어요.
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400">
          BalanceDot WorkFlow · 문의는 담당자에게 연락해 주세요
        </p>
      </div>
    </div>
  );
}
