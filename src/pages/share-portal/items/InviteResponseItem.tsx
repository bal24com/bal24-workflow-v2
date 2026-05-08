// bal24 v2 — 외부공유 항목 · 초대수락/거절 (전문가, 사전·준비)
// curriculum_staff 본인 매칭된 차시 → status (pending/accepted/rejected) UPDATE.

import { useEffect, useState } from 'react';
import {
  HandshakeIcon, Loader2, Check, X, Calendar, Clock,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import { trimTime } from '../../programs/detail/curriculum/curriculumTabUtils';
import { STAFF_STATUS_LABEL, STAFF_STATUS_STYLE, STAFF_ROLE_STYLE } from '../../../lib/curriculumStaff';
import { BADGE_BASE } from '../../../utils/statusStyles';
import type {
  CurriculumStaffStatus, CurriculumStaffRole,
} from '../../../types/database';
import ItemCard from './ItemCard';

interface MyMatchRow {
  id: string;
  role: CurriculumStaffRole;
  status: CurriculumStaffStatus;
  fee: number | null;
  note: string | null;
  curriculum: {
    session_no: number;
    title: string;
    session_date: string | null;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
  };
}

interface Props {
  curriculumStaffIds: string[];
}

export default function InviteResponseItem({ curriculumStaffIds }: Props) {
  const [list, setList] = useState<MyMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    if (curriculumStaffIds.length === 0) {
      setList([]);
      return;
    }
    const { data, error } = await supabase
      .from('curriculum_staff')
      .select(
        'id, role, status, fee, note, curriculum:program_curriculum(session_no, title, session_date, start_time, end_time, venue)',
      )
      .in('id', curriculumStaffIds);
    if (error) {
      console.error('[share-portal/expert] 본인 매칭 조회 실패:', error.message);
      setErrMsg('내 차시 정보를 불러오지 못했어요.');
      return;
    }
    type Row = {
      id: string;
      role: CurriculumStaffRole;
      status: CurriculumStaffStatus;
      fee: number | null;
      note: string | null;
      curriculum: MyMatchRow['curriculum'] | MyMatchRow['curriculum'][] | null;
    };
    const rows = (data as Row[] | null) ?? [];
    const mapped: MyMatchRow[] = rows
      .map((r) => {
        const cur = Array.isArray(r.curriculum) ? r.curriculum[0] : r.curriculum;
        if (!cur) return null;
        return { id: r.id, role: r.role, status: r.status, fee: r.fee, note: r.note, curriculum: cur };
      })
      .filter((r): r is MyMatchRow => r !== null)
      .sort((a, b) => a.curriculum.session_no - b.curriculum.session_no);
    setList(mapped);
    setErrMsg(null);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumStaffIds.join(',')]);

  async function changeStatus(id: string, next: 'accepted' | 'rejected') {
    setBusy(id);
    try {
      const { error } = await supabase
        .from('curriculum_staff')
        .update({ status: next, responded_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[share-portal/expert] 응답 저장 실패:', error.message);
        setErrMsg('응답 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setErrMsg(null);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ItemCard
      icon={<HandshakeIcon size={18} aria-hidden="true" />}
      title="초대 수락/거절"
      hint={`총 ${list.length}개 차시 — 차시별로 수락/거절을 선택해 주세요`}
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-2">
          매칭된 차시가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold tabular-nums">
                  {m.curriculum.session_no}차시
                </span>
                <span className={`${BADGE_BASE} ${STAFF_ROLE_STYLE[m.role]}`}>{m.role}</span>
                <span className={`${BADGE_BASE} ${STAFF_STATUS_STYLE[m.status]} ml-auto`}>
                  {STAFF_STATUS_LABEL[m.status]}
                </span>
              </div>
              <p className="text-sm font-bold text-[#1E1B4B]">{m.curriculum.title}</p>
              <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                {m.curriculum.session_date && (
                  <span className="inline-flex items-center gap-0.5">
                    <Calendar size={11} aria-hidden="true" />
                    {formatDateKo(m.curriculum.session_date)}
                  </span>
                )}
                {(m.curriculum.start_time || m.curriculum.end_time) && (
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    <Clock size={11} aria-hidden="true" />
                    {trimTime(m.curriculum.start_time)}
                    {m.curriculum.end_time && `~${trimTime(m.curriculum.end_time)}`}
                  </span>
                )}
                {m.curriculum.venue && <span>📍 {m.curriculum.venue}</span>}
                {m.fee != null && (
                  <span className="ml-auto text-violet-700 font-semibold">
                    {formatMoney(m.fee)}
                  </span>
                )}
              </div>
              {m.note && (
                <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{m.note}</p>
              )}

              {m.status === 'pending' ? (
                <div className="flex items-center gap-2 pt-1 border-t border-violet-100/70">
                  <button
                    type="button"
                    onClick={() => void changeStatus(m.id, 'rejected')}
                    disabled={busy === m.id}
                    className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl border border-rose-200 bg-white text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                  >
                    <X size={14} aria-hidden="true" />
                    거절
                  </button>
                  <button
                    type="button"
                    onClick={() => void changeStatus(m.id, 'accepted')}
                    disabled={busy === m.id}
                    className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} aria-hidden="true" />
                    수락
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 text-center pt-1 border-t border-violet-100/70">
                  ⓘ 이미 응답하셨어요. 변경이 필요하면 담당자에게 문의해 주세요.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {errMsg && (
        <p role="alert" className="mt-2 text-xs text-rose-600 font-semibold">{errMsg}</p>
      )}
    </ItemCard>
  );
}
