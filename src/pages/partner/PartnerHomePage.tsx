// bal24 v2 — STEP-PARTNER-SIDEBAR PARTNER 전용 홈 (/partner-home)
// 환영 배너 + 요약 2 카드 + 담당 프로그램 그리드 + 마이페이지 링크.

import { Link, Navigate } from 'react-router-dom';
import { ExternalLink, Loader2, ChevronRight, MapPin, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '../../components/ui';
import EmptyState from '../../components/EmptyState';
import { formatDateKo } from '../../lib/utils';
import { BADGE_BASE, PROGRAM_STATUS_STYLE } from '../../utils/statusStyles';
import { usePartnerProfile } from '../../hooks/usePartnerProfile';
import {
  PARTNER_ROLE_LABEL, PARTNER_ROLE_COLOR,
} from '../../types/partner';
import type { ProgramStatus } from '../../types/database';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  emoji: string;
}

function StatCard({ label, value, unit, emoji }: StatCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 text-center space-y-1">
        <div className="text-xl" aria-hidden="true">{emoji}</div>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-bold text-[#1E1B4B] tabular-nums">
          {value}<span className="text-sm font-semibold text-slate-400 ml-0.5">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default function PartnerHomePage() {
  const { profile, programs, isPartner, isLoading } = usePartnerProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        <Loader2 size={20} className="animate-spin mr-2 text-orange-400" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  // PARTNER 가 아니면 일반 홈으로
  if (!isPartner) {
    return <Navigate to="/home" replace />;
  }

  const totalCount = programs.length;
  const ongoingCount = programs.filter((p) => p.status === '진행').length;

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* 환영 배너 */}
      <header className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 text-white p-5 shadow-[0_4px_16px_rgba(249,115,22,0.18)]">
        <p className="text-xs font-semibold opacity-90">참여사 담당자</p>
        <h1 className="mt-1 text-xl font-bold">
          안녕하세요, {profile?.name ?? '담당자'}님 <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-xs opacity-90">담당 프로그램 현황을 한눈에 확인하세요.</p>
      </header>

      {/* 요약 카드 2 */}
      <ul className="grid grid-cols-2 gap-3 max-w-md">
        <li><StatCard label="담당 프로그램" value={totalCount} unit="개" emoji="📚" /></li>
        <li><StatCard label="진행 중" value={ongoingCount} unit="개" emoji="🚀" /></li>
      </ul>

      {/* 담당 프로그램 목록 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#1E1B4B]">담당 프로그램</h2>
        {programs.length === 0 ? (
          <EmptyState
            emoji="📭"
            title="담당 프로그램이 아직 없어요"
            description="PM 이 배정하면 여기에 표시돼요."
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {programs.map((p) => (
              <li key={p.id}>
                <Card className="h-full hover:border-orange-300 hover:shadow-md transition-all">
                  <CardContent className="p-4 space-y-2">
                    <header className="flex items-center justify-between gap-2 flex-wrap">
                      {p.assignment_role && (
                        <span className={`${BADGE_BASE} ${PARTNER_ROLE_COLOR[p.assignment_role]}`}>
                          {PARTNER_ROLE_LABEL[p.assignment_role]}
                        </span>
                      )}
                      {p.status && (
                        <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[p.status as ProgramStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {p.status}
                        </span>
                      )}
                    </header>

                    <h3 className="text-sm font-bold text-[#1E1B4B] truncate">{p.name}</h3>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      {(p.start_date || p.end_date) && (
                        <p className="inline-flex items-center gap-1 tabular-nums">
                          <CalendarDays size={11} aria-hidden="true" />
                          {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
                        </p>
                      )}
                      {p.venue && (
                        <p className="inline-flex items-center gap-1 truncate">
                          <MapPin size={11} aria-hidden="true" />
                          {p.venue}
                        </p>
                      )}
                    </div>

                    <Link
                      to={`/programs/${p.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors w-full justify-center"
                    >
                      상세 보기
                      <ChevronRight size={12} aria-hidden="true" />
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 내 마이페이지 링크 */}
      {profile?.my_token && (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#1E1B4B]">내 마이페이지</p>
            <p className="text-xs text-slate-500 mt-0.5">멘토링·신청 내역까지 한 곳에서 확인하세요.</p>
          </div>
          <Link
            to={`/my/${profile.my_token}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
          >
            <ExternalLink size={12} aria-hidden="true" />
            바로가기
          </Link>
        </section>
      )}
    </div>
  );
}
