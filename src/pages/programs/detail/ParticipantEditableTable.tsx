// bal24 v2 — STEP-PARTICIPANTS-LIST-UPDATE (리팩토링)
// 컬럼: 순서(▲▼) | # | 이름 | 소속 | 연락처 | 이메일 | 주민번호(마스킹) | 상태 | 수정
// 인라인 편집 → 모달 방식 (ParticipantEditModal)
// V-1: 이 파일은 표시·순서변경·삭제만. 편집 모달은 ParticipantEditModal.tsx

import { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type { ProgramParticipant } from '../../../types/database';
import {
  PARTICIPANT_STATUS_LABEL,
  PARTICIPANT_STATUS_STYLE,
  BADGE_BASE,
} from '../../../utils/statusStyles';
import ParticipantEditModal from './ParticipantEditModal';

interface Props {
  list: ProgramParticipant[];
  canEdit: boolean;
  onChanged: () => void;
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  allSelected?: boolean;
  onToggleAll?: () => void;
}

/** 주민번호 마스킹: 앞 6자리-뒷 첫자리****** */
function maskIdNumber(raw?: string | null): string {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length < 7) return raw.length > 0 ? raw : '—';
  return `${d.slice(0, 6)}-${d[6]}******`;
}

export default function ParticipantEditableTable({
  list, canEdit, onChanged,
  selectedIds, onToggleOne, allSelected, onToggleAll,
}: Props) {
  const bulkEnabled = !!onToggleOne;
  const toast = useToast();
  const [editTarget, setEditTarget] = useState<ProgramParticipant | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  /** ▲▼ 순서 변경: 인접 행과 display_order 스왑 */
  async function handleMove(idx: number, dir: -1 | 1) {
    const a = list[idx];
    const b = list[idx + dir];
    if (!a || !b) return;
    const aOrder = a.display_order ?? idx * 10;
    const bOrder = b.display_order ?? (idx + dir) * 10;
    // 같은 값이면 임의 분리
    const aNew = aOrder === bOrder ? aOrder + dir : bOrder;
    const bNew = aOrder === bOrder ? aOrder       : aOrder;
    setReorderingId(a.id);
    const { error: e1 } = await supabase
      .from('program_participants').update({ display_order: aNew }).eq('id', a.id);
    const { error: e2 } = await supabase
      .from('program_participants').update({ display_order: bNew }).eq('id', b.id);
    setReorderingId(null);
    if (e1 || e2) {
      console.error('[participant-table] 순서 변경 실패:', (e1 ?? e2)?.message);
      toast.error('순서 변경에 실패했어요.');
      return;
    }
    onChanged();
  }

  async function handleDelete(p: ProgramParticipant) {
    if (!window.confirm(`"${p.name}" 참여자를 삭제할까요? 되돌릴 수 없어요.`)) return;
    const { error } = await supabase.from('program_participants').delete().eq('id', p.id);
    if (error) {
      console.error('[participant-table] 삭제 실패:', error.message);
      toast.error('삭제에 실패했어요.');
      return;
    }
    toast.success('삭제했어요.');
    onChanged();
  }

  return (
    <>
      <div className="rounded-2xl border border-violet-100 bg-white overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-violet-50/40 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              {bulkEnabled && (
                <th className="px-2 py-2 text-center font-bold w-8">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onToggleAll}
                    aria-label="전체 선택"
                    className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600
                               focus:ring-violet-400 cursor-pointer"
                  />
                </th>
              )}
              {/* 순서 핸들 */}
              {canEdit && (
                <th className="px-1 py-2 text-center font-bold w-12">순서</th>
              )}
              <th className="px-2 py-2 text-center font-bold w-8">#</th>
              <th className="px-2 py-2 text-left font-bold">이름</th>
              <th className="px-2 py-2 text-left font-bold">소속</th>
              <th className="px-2 py-2 text-left font-bold">연락처</th>
              <th className="px-2 py-2 text-left font-bold">이메일</th>
              <th className="px-2 py-2 text-left font-bold">주민번호</th>
              <th className="px-2 py-2 text-center font-bold w-20">상태</th>
              {canEdit && (
                <th className="px-2 py-2 text-right font-bold w-14">수정</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((p, idx) => (
              <tr key={p.id} className="hover:bg-violet-50/20 transition-colors">
                {/* 일괄 선택 체크박스 */}
                {bulkEnabled && (
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(p.id) ?? false}
                      onChange={() => onToggleOne?.(p.id)}
                      aria-label={`${p.name} 선택`}
                      className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600
                                 focus:ring-violet-400 cursor-pointer"
                    />
                  </td>
                )}
                {/* ▲▼ 순서 버튼 */}
                {canEdit && (
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex flex-col items-center gap-0">
                      <button
                        type="button"
                        disabled={idx === 0 || reorderingId === p.id}
                        onClick={() => void handleMove(idx, -1)}
                        className="p-0.5 rounded text-slate-400 hover:text-violet-600
                                   hover:bg-violet-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="위로"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === list.length - 1 || reorderingId === p.id}
                        onClick={() => void handleMove(idx, 1)}
                        className="p-0.5 rounded text-slate-400 hover:text-violet-600
                                   hover:bg-violet-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="아래로"
                      >
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </td>
                )}
                {/* 번호 */}
                <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">
                  {idx + 1}
                </td>
                {/* 이름 */}
                <td className="px-2 py-1.5 font-semibold text-[#1E1B4B] whitespace-nowrap">
                  {p.name}
                </td>
                {/* 소속 */}
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap max-w-[120px] truncate">
                  {p.organization || '—'}
                </td>
                {/* 연락처 */}
                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap tabular-nums">
                  {p.phone || '—'}
                </td>
                {/* 이메일 */}
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap max-w-[160px] truncate">
                  {p.email || '—'}
                </td>
                {/* 주민번호 (마스킹) */}
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap tabular-nums">
                  {maskIdNumber(p.id_number)}
                </td>
                {/* 상태 배지 */}
                <td className="px-2 py-1.5 text-center">
                  <span className={`${BADGE_BASE} ${PARTICIPANT_STATUS_STYLE[p.status]}`}>
                    {PARTICIPANT_STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </td>
                {/* 수정 버튼 */}
                {canEdit && (
                  <td className="px-2 py-1.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditTarget(p)}
                        className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50
                                   border border-violet-200 transition-colors"
                        aria-label={`${p.name} 수정`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(p)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50
                                   border border-rose-200 transition-colors"
                        aria-label={`${p.name} 삭제`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? (bulkEnabled ? 9 : 8) : (bulkEnabled ? 8 : 7)}
                  className="py-8 text-center text-slate-400 italic text-xs"
                >
                  참여자가 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 수정 모달 (분리된 파일) */}
      <ParticipantEditModal
        participant={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); onChanged(); }}
      />
    </>
  );
}
