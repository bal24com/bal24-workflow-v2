// bal24 v2 — 교육생 신청 관리 패널 (Stage 11-③)
// participant_applications 목록·상태 변경 (검토중/승인/반려).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, UserPlus, Phone, Mail, Building2, Check, X, RotateCcw,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { formatDateKo } from '../../../../lib/utils';
import { BADGE_BASE } from '../../../../utils/statusStyles';
import { PARTICIPANT_STATUS_LABEL } from '../programDetailUtils';
import { useAuth } from '../../../../contexts/AuthContext';
import type { ParticipantStatus } from '../../../../types/application';

interface Props {
  programId: string;
}

interface Row {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  organization: string | null;
  motivation: string | null;
  status: ParticipantStatus;
  created_at: string;
}

const STATUS_STYLE: Record<ParticipantStatus, string> = {
  applied: 'bg-slate-100 text-slate-500 border-slate-300',
  reviewing: 'bg-orange-50 text-orange-600 border-orange-200',
  accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  withdrawn: 'bg-slate-100 text-slate-400 border-slate-300',
  completed: 'bg-violet-50 text-violet-700 border-violet-200',
};

const FILTER_TABS: Array<{ key: 'all' | ParticipantStatus; label: string }> = [
  { key: 'all',       label: '전체' },
  { key: 'applied',   label: '신청' },
  { key: 'reviewing', label: '검토중' },
  { key: 'accepted',  label: '승인' },
  { key: 'rejected',  label: '반려' },
];

export default function ApplicationsPanel({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ParticipantStatus>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('participant_applications')
      .select('id, name, phone, email, organization, motivation, status, created_at')
      .eq('program_id', programId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[step-11/applications] 조회 실패:', error.message);
      toast.error('신청 목록을 불러오지 못했어요.');
      return;
    }
    setRows((data as Row[] | null) ?? []);
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, refresh]);

  const counts = useMemo(() => {
    const acc: Record<'all' | ParticipantStatus, number> = {
      all: rows.length,
      applied: 0, reviewing: 0, accepted: 0, rejected: 0, withdrawn: 0, completed: 0,
    };
    rows.forEach((r) => { acc[r.status] += 1; });
    return acc;
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function changeStatus(id: string, next: ParticipantStatus) {
    setBusy(id);
    try {
      const patch: Record<string, unknown> = {
        status: next,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      };
      if (next === 'completed') patch.completed_at = new Date().toISOString();
      const { error } = await supabase
        .from('participant_applications')
        .update(patch)
        .eq('id', id);
      if (error) {
        console.error('[step-11/applications] 상태 변경 실패:', error.message);
        toast.error('상태 변경에 실패했어요.');
        return;
      }
      toast.success(`상태를 "${PARTICIPANT_STATUS_LABEL[next]}"으로 변경했어요.`);
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <UserPlus size={16} className="text-cyan-500" aria-hidden="true" />
          교육생 신청 ({rows.length})
        </h3>
        <p className="text-[11px] text-slate-500">
          승인 / 반려 / 검토중 상태를 클릭으로 변경
        </p>
      </header>

      {/* 필터 탭 */}
      <div role="tablist" aria-label="신청 상태 필터" className="flex flex-wrap items-center gap-1.5">
        {FILTER_TABS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      {visible.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          {filter === 'all' ? '아직 신청자가 없어요.' : '해당 상태의 신청이 없어요.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((r) => {
            const isOpen = openId === r.id;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-violet-100 bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-violet-50/30 transition-colors text-left"
                >
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1E1B4B]">
                    {r.name}
                    <span className="ml-1 text-[10px] text-slate-400 font-normal">· {r.phone}</span>
                  </span>
                  {r.organization && (
                    <span className="hidden sm:inline shrink-0 text-[10px] text-slate-400 truncate max-w-[120px]">
                      {r.organization}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                    {formatDateKo(r.created_at).replace(/^\d{4}년\s/, '')}
                  </span>
                  <span className={`${BADGE_BASE} ${STATUS_STYLE[r.status]} shrink-0`}>
                    {PARTICIPANT_STATUS_LABEL[r.status]}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-violet-100/70 bg-violet-50/20 px-3 py-3 flex flex-col gap-2.5">
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} aria-hidden="true" />
                        {r.phone}
                      </span>
                      {r.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={11} aria-hidden="true" />
                          {r.email}
                        </span>
                      )}
                      {r.organization && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} aria-hidden="true" />
                          {r.organization}
                        </span>
                      )}
                    </div>

                    {r.motivation && (
                      <div className="rounded-md bg-white border border-violet-100 px-3 py-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-1">지원 동기</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {r.motivation}
                        </p>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-violet-100/70">
                      {r.status !== 'reviewing' && r.status !== 'accepted' && r.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(r.id, 'reviewing')}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                        >
                          <RotateCcw size={11} aria-hidden="true" />
                          검토 시작
                        </button>
                      )}
                      {r.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(r.id, 'rejected')}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X size={11} aria-hidden="true" />
                          반려
                        </button>
                      )}
                      {r.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(r.id, 'accepted')}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-0.5 px-3 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={11} aria-hidden="true" />
                          승인
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
