// bal24 v2 — STEP-MENTOR-MENTEE-MATCHING
// 멘토 카드에서 [멘티 배정] 클릭 → 해당 mentoring_assignment의 mentee_ids 편집.
// 다중 선택(체크박스) 모달.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search, Users2, X } from 'lucide-react';
import { Modal, Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { getMentorName } from '../../../types/mentoring';
import type { MentoringAssignment } from '../../../types/mentoring';

interface MenteeOption {
  id: string;
  name: string;
  organization: string | null;
  status: string;
}

interface Props {
  open: boolean;
  programId: string;
  assignment: MentoringAssignment | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function MenteeAssignModal({ open, programId, assignment, onClose, onSaved }: Props) {
  const toast = useToast();
  const [options, setOptions] = useState<MenteeOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_participants')
      .select('id, name, organization, status')
      .eq('program_id', programId)
      .in('status', ['active', 'completed', 'pending', 'incomplete'])
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });
    setLoading(false);
    if (error) {
      console.error('[mentee-assign] 교육생 조회 실패:', error.message);
      toast.error('교육생 목록을 불러오지 못했어요.');
      return;
    }
    setOptions((data ?? []) as MenteeOption[]);
  }, [programId, toast]);

  // 모달 열릴 때마다 fetch + 기존 선택값 복원
  useEffect(() => {
    if (!open || !assignment) return;
    setSelectedIds(assignment.mentee_ids ?? []);
    setSearch('');
    void fetchData();
  }, [open, assignment, fetchData]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      (o.organization ?? '').toLowerCase().includes(q));
  }, [options, search]);

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const visibleIds = visible.map((v) => v.id);
      const allSelected = visibleIds.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  async function handleSave() {
    if (!assignment) return;
    setSaving(true);
    const { error } = await supabase.from('mentoring_assignments')
      .update({ mentee_ids: selectedIds })
      .eq('id', assignment.id);
    setSaving(false);
    if (error) {
      console.error('[mentee-assign] 저장 실패:', error.message);
      toast.error('멘티 배정 저장에 실패했어요.');
      return;
    }
    toast.success(`${selectedIds.length}명의 멘티를 배정했어요.`);
    onSaved();
    onClose();
  }

  if (!assignment) return null;

  const visibleAllSelected =
    visible.length > 0 && visible.every((v) => selectedIds.includes(v.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${getMentorName(assignment)}님 멘티 배정`}
      description="이 멘토에게 배정할 교육생을 선택해 주세요. 다중 선택 가능."
      size="lg"
      closeOnBackdrop={!saving}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            선택 <strong className="text-violet-700 tabular-nums">{selectedIds.length}</strong>명
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              <X size={14} className="mr-1" /> 취소
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              <Save size={14} className="mr-1" /> 배정 완료
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* 검색 + 전체 토글 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="이름·소속 검색…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-violet-400" />
          </div>
          <button type="button" onClick={toggleAll} disabled={loading || visible.length === 0}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50">
            {visibleAllSelected ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        {/* 멘티 목록 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-10 flex items-center justify-center gap-2">
            <Users2 size={16} aria-hidden="true" />
            {options.length === 0 ? '등록된 교육생이 없어요.' : '검색 결과가 없어요.'}
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {visible.map((o) => {
              const checked = selectedIds.includes(o.id);
              return (
                <li key={o.id}>
                  <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    checked ? 'bg-violet-50/60' : 'hover:bg-violet-50/30'
                  }`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(o.id)}
                      className="w-4 h-4 rounded border-violet-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1E1B4B] truncate">{o.name}</p>
                      {o.organization && (
                        <p className="text-xs text-slate-500 truncate">{o.organization}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{o.status}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
