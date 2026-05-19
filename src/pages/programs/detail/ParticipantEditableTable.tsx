// bal24 v2 — STEP-PROGRAM-ENHANCE-FULL 교육생 인라인 편집 테이블
// 이름·소속·연락처·주민번호(마스킹)·상태 + 행별 편집 모드 + 삭제

import { useState } from 'react';
import { Pencil, Save, X, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type { ProgramParticipant, ParticipantStatus } from '../../../types/database';

interface Props {
  list: ProgramParticipant[];
  canEdit: boolean;
  onChanged: () => void;
  // STEP-PARTICIPANT-BULK-DELETE — 다중 선택 prop
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  allSelected?: boolean;
  onToggleAll?: () => void;
}

interface Edit {
  name: string; organization: string; phone: string; id_number: string;
  status: ParticipantStatus;
}

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  active: '진행중', completed: '수료', dropped: '탈락', pending: '대기', inactive: '비활성',
};
const STATUS_STYLE: Record<ParticipantStatus, string> = {
  active:    'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  dropped:   'bg-rose-100 text-rose-700',
  pending:   'bg-slate-100 text-slate-600',
  inactive:  'bg-slate-100 text-slate-400',
};

function maskIdNumber(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length < 7) return '';
  return `${d.slice(0, 6)}-${d[6]}******`;
}

function fromRow(p: ProgramParticipant): Edit {
  return {
    name: p.name ?? '',
    organization: p.organization ?? '',
    phone: p.phone ?? '',
    id_number: p.id_number ?? '',
    status: p.status,
  };
}

export default function ParticipantEditableTable({
  list, canEdit, onChanged,
  selectedIds, onToggleOne, allSelected, onToggleAll,
}: Props) {
  const bulkEnabled = !!onToggleOne;
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Edit | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(p: ProgramParticipant) { setEditingId(p.id); setForm(fromRow(p)); }
  function cancelEdit() { setEditingId(null); setForm(null); }

  async function handleSave() {
    if (!editingId || !form) return;
    setSaving(true);
    const { error } = await supabase.from('program_participants').update({
      name: form.name.trim(),
      organization: form.organization.trim() || null,
      phone: form.phone.trim() || null,
      id_number: form.id_number.replace(/\D/g, '') || null,
      status: form.status,
    }).eq('id', editingId);
    setSaving(false);
    if (error) { console.error('[participant-edit] 저장 실패:', error.message); toast.error('수정에 실패했어요.'); return; }
    toast.success('수정했어요.');
    cancelEdit();
    onChanged();
  }

  async function handleDelete(p: ProgramParticipant) {
    if (!window.confirm(`"${p.name}" 교육생을 삭제할까요?`)) return;
    const { error } = await supabase.from('program_participants').delete().eq('id', p.id);
    if (error) { console.error('[participant-edit] 삭제 실패:', error.message); toast.error('삭제에 실패했어요.'); return; }
    toast.success('삭제했어요.');
    onChanged();
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-violet-50/40 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            {bulkEnabled && (
              <th className="px-2 py-2 text-center font-bold w-8">
                <input type="checkbox" checked={!!allSelected} onChange={onToggleAll}
                  aria-label="전체 선택"
                  className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
              </th>
            )}
            <th className="px-2 py-2 text-center font-bold w-10">#</th>
            <th className="px-2 py-2 text-left font-bold">이름</th>
            <th className="px-2 py-2 text-left font-bold">소속</th>
            <th className="px-2 py-2 text-left font-bold">연락처</th>
            <th className="px-2 py-2 text-left font-bold">주민번호</th>
            <th className="px-2 py-2 text-center font-bold">상태</th>
            {canEdit && <th className="px-2 py-2 text-right font-bold w-20">편집</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((p, idx) => {
            const isEd = editingId === p.id && form;
            return (
              <tr key={p.id} className={isEd ? 'bg-violet-50/40' : 'hover:bg-violet-50/20'}>
                {bulkEnabled && (
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={selectedIds?.has(p.id) ?? false}
                      onChange={() => onToggleOne?.(p.id)} aria-label={`${p.name} 선택`}
                      className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
                  </td>
                )}
                <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                {isEd && form ? (
                  <>
                    <td className="px-1 py-1"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full h-7 px-1.5 rounded border border-violet-200 text-xs focus:outline-none focus:border-violet-500" /></td>
                    <td className="px-1 py-1"><input value={form.organization} placeholder="소속" onChange={(e) => setForm({ ...form, organization: e.target.value })}
                      className="w-full h-7 px-1.5 rounded border border-violet-200 text-xs focus:outline-none focus:border-violet-500" /></td>
                    <td className="px-1 py-1"><input value={form.phone} placeholder="010-…" onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full h-7 px-1.5 rounded border border-violet-200 text-xs focus:outline-none focus:border-violet-500" /></td>
                    <td className="px-1 py-1"><input value={form.id_number} placeholder="6자리 + 뒷자리" onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                      className="w-full h-7 px-1.5 rounded border border-violet-200 text-xs focus:outline-none focus:border-violet-500" /></td>
                    <td className="px-1 py-1 text-center">
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ParticipantStatus })}
                        className="h-7 px-1 rounded border border-violet-200 text-xs focus:outline-none focus:border-violet-500">
                        <option value="active">진행중</option>
                        <option value="completed">수료</option>
                        <option value="dropped">탈락</option>
                        <option value="pending">대기</option>
                      </select>
                    </td>
                    {canEdit && (
                      <td className="px-2 py-1 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <button type="button" disabled={saving} onClick={() => void handleSave()}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50" aria-label="저장"><Save size={12} /></button>
                          <button type="button" disabled={saving} onClick={cancelEdit}
                            className="p-1 rounded text-slate-400 hover:bg-slate-100" aria-label="취소"><X size={12} /></button>
                        </div>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-2 py-1.5 font-bold text-slate-700">{p.name || <span className="text-slate-300 italic">미입력</span>}</td>
                    <td className="px-2 py-1.5 text-slate-600">{p.organization ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-slate-600 tabular-nums">{p.phone ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-slate-600 tabular-nums">{maskIdNumber(p.id_number) || <span className="text-slate-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLE[p.status]}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-2 py-1.5 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => startEdit(p)} aria-label="편집"
                            className="p-1 rounded text-slate-400 hover:bg-violet-50 hover:text-violet-600"><Pencil size={11} /></button>
                          {p.status === 'active' && (
                            <button type="button" onClick={async () => {
                              const { error } = await supabase.from('program_participants').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', p.id);
                              if (error) { toast.error('수료 처리에 실패했어요.'); return; }
                              toast.success('수료 처리했어요.'); onChanged();
                            }} aria-label="수료"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><CheckCircle2 size={11} /></button>
                          )}
                          <button type="button" onClick={() => void handleDelete(p)} aria-label="삭제"
                            className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={11} /></button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
