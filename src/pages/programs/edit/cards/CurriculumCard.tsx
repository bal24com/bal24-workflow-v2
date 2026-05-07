// bal24 v2 — 프로그램 수정 풀 페이지 · ⑥ 커리큘럼 (자체 CRUD)
// program_curriculum 차시 입력 + curriculum_staff 인력 매칭.

import { useCallback, useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Trash2, Loader2, UserPlus } from 'lucide-react';
import CardShell, { Field, inputClass, textareaClass } from './CardShell';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import { supabase } from '../../../../lib/supabase';
import StaffMatchModal from '../curriculum/StaffMatchModal';
import StaffMatchRow, { type MatchedStaffRow } from '../curriculum/StaffMatchRow';
import { staffSource } from '../../../../lib/curriculumStaff';
import type {
  ProgramCurriculum,
  CurriculumStaff,
} from '../../../../types/database';

interface Props {
  programId: string;
}

interface CurriculumWithStaff extends ProgramCurriculum {
  staff: MatchedStaffRow[];
}

type StaffJoinRow = CurriculumStaff & {
  staff_pool: { id: string; name: string } | null;
  profile: { id: string; name: string } | null;
};

export default function CurriculumCard({ programId }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<CurriculumWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [matchModalCurriculumId, setMatchModalCurriculumId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const curRes = await supabase
        .from('program_curriculum')
        .select('*')
        .eq('program_id', programId)
        .order('session_no', { ascending: true });

      if (curRes.error) {
        console.error('[program-edit] 커리큘럼 조회 실패:', curRes.error.message);
        toast.error('커리큘럼을 불러오지 못했어요.');
        return;
      }

      const curriculumRows = (curRes.data as ProgramCurriculum[] | null) ?? [];
      const curriculumIds = curriculumRows.map((c) => c.id);

      let staffByCurriculum: Record<string, MatchedStaffRow[]> = {};
      if (curriculumIds.length > 0) {
        const staffRes = await supabase
          .from('curriculum_staff')
          .select('*, staff_pool:staff_pool(id,name), profile:profiles(id,name)')
          .in('curriculum_id', curriculumIds)
          .order('created_at', { ascending: true });
        if (staffRes.error) {
          console.error('[program-edit] 매칭 인력 조회 실패:', staffRes.error.message);
        } else {
          staffByCurriculum = ((staffRes.data as StaffJoinRow[] | null) ?? []).reduce<Record<string, MatchedStaffRow[]>>((acc, s) => {
            const sourceVal = staffSource(s);
            const name =
              sourceVal === 'external' ? s.staff_pool?.name ?? '?' : s.profile?.name ?? '?';
            (acc[s.curriculum_id] ||= []).push({
              id: s.id,
              name,
              source: sourceVal,
              role: s.role,
              status: s.status,
              fee: s.fee ?? null,
              token: s.token,
              note: s.note ?? null,
            });
            return acc;
          }, {});
        }
      }

      setItems(curriculumRows.map((c) => ({ ...c, staff: staffByCurriculum[c.id] ?? [] })));
    } finally {
      setLoading(false);
    }
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, refresh]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addCurriculum() {
    const nextNo =
      items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0) + 1;
    const { data, error } = await supabase
      .from('program_curriculum')
      .insert({
        program_id: programId,
        session_no: nextNo,
        title: `${nextNo}차시`,
      })
      .select('*')
      .maybeSingle();
    if (error || !data) {
      console.error('[program-edit] 차시 추가 실패:', error?.message);
      toast.error('차시 추가에 실패했어요.');
      return;
    }
    const inserted = data as ProgramCurriculum;
    setItems((prev) => [...prev, { ...inserted, staff: [] }]);
    setOpenIds((prev) => new Set(prev).add(inserted.id));
  }

  async function updateCurriculum(id: string, patch: Partial<ProgramCurriculum>) {
    const { error } = await supabase.from('program_curriculum').update(patch).eq('id', id);
    if (error) {
      console.error('[program-edit] 차시 수정 실패:', error.message);
      toast.error('차시 수정에 실패했어요.');
      return;
    }
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function removeCurriculum(id: string) {
    if (!window.confirm('이 차시와 매칭된 인력 정보를 모두 삭제할까요?')) return;
    const { error } = await supabase.from('program_curriculum').delete().eq('id', id);
    if (error) {
      console.error('[program-edit] 차시 삭제 실패:', error.message);
      toast.error('차시 삭제에 실패했어요.');
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
    toast.success('차시를 삭제했어요.');
  }

  async function removeStaff(staffId: string) {
    if (!window.confirm('이 매칭 인력을 삭제할까요?')) return;
    const { error } = await supabase.from('curriculum_staff').delete().eq('id', staffId);
    if (error) {
      console.error('[program-edit] 매칭 인력 삭제 실패:', error.message);
      toast.error('인력 삭제에 실패했어요.');
      return;
    }
    void refresh();
    toast.success('매칭 인력을 삭제했어요.');
  }

  return (
    <CardShell
      step="⑥"
      title="커리큘럼"
      description="차시별 일정 + 인력 매칭. 매칭 시 외부 참여의사 링크가 자동 생성돼요."
      actions={
        <Button variant="primary" size="sm" onClick={addCurriculum} leftIcon={<Plus size={12} />}>
          차시 추가
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          등록된 차시가 없어요. "차시 추가"로 시작하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => {
            const isOpen = openIds.has(c.id);
            return (
              <li key={c.id} className="rounded-xl border border-violet-100 bg-violet-50/30 overflow-hidden">
                <header className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleOpen(c.id)}
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-violet-100 text-violet-600"
                    aria-label={isOpen ? '접기' : '펼치기'}
                  >
                    {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                  </button>
                  <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold tabular-nums">
                    {c.session_no}차시
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                    {c.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">매칭 {c.staff.length}명</span>
                  <button
                    type="button"
                    onClick={() => removeCurriculum(c.id)}
                    title="차시 삭제"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </header>

                {isOpen && (
                  <div className="px-3 pb-3 flex flex-col gap-2.5 border-t border-violet-100/70 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5">
                      <Field label="회차">
                        <input
                          type="number"
                          min={1}
                          value={c.session_no}
                          onChange={(e) => updateCurriculum(c.id, { session_no: Number(e.target.value) || c.session_no })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="날짜">
                        <input
                          type="date"
                          value={c.session_date ?? ''}
                          onChange={(e) => updateCurriculum(c.id, { session_date: e.target.value || null })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="시간(분)">
                        <input
                          type="number"
                          min={0}
                          value={c.duration ?? ''}
                          onChange={(e) =>
                            updateCurriculum(c.id, {
                              duration: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="예) 90"
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <Field label="장소">
                      <input
                        type="text"
                        value={c.venue ?? ''}
                        onChange={(e) => updateCurriculum(c.id, { venue: e.target.value || null })}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="제목" required>
                      <input
                        type="text"
                        value={c.title}
                        onChange={(e) => updateCurriculum(c.id, { title: e.target.value })}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="내용">
                      <textarea
                        value={c.content ?? ''}
                        onChange={(e) => updateCurriculum(c.id, { content: e.target.value || null })}
                        className={textareaClass}
                      />
                    </Field>

                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-600">매칭 인력 ({c.staff.length})</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMatchModalCurriculumId(c.id)}
                          leftIcon={<UserPlus size={11} />}
                        >
                          인력 추가
                        </Button>
                      </div>
                      {c.staff.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">매칭된 인력이 없어요.</p>
                      ) : (
                        c.staff.map((row) => (
                          <StaffMatchRow key={row.id} row={row} onDelete={() => removeStaff(row.id)} />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <StaffMatchModal
        open={matchModalCurriculumId !== null}
        onClose={() => setMatchModalCurriculumId(null)}
        curriculumId={matchModalCurriculumId ?? ''}
        onAdded={() => void refresh()}
      />
    </CardShell>
  );
}
