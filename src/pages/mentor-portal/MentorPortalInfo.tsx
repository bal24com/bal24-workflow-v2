// bal24 v2 — STEP-MENTOR-PORTAL-FULL
// 멘토 포털 — 배정 정보 + (미등록 멘토용) 내 정보 등록 섹션

import { useState } from 'react';
import { Loader2, Save, User2, Users2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { getMentorName, isUnregisteredMentor, type MentoringAssignment } from '../../types/mentoring';

interface MenteeLite { id: string; name: string; organization: string | null }

interface Props {
  assignment: MentoringAssignment;
  mentees: MenteeLite[];
  onUpdated: () => void;
}

export default function MentorPortalInfo({ assignment, mentees, onUpdated }: Props) {
  const toast = useToast();
  const unregistered = isUnregisteredMentor(assignment);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(assignment.mentor_name_raw ?? '');
  const [pmNote, setPmNote] = useState(assignment.pm_note ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error('이름을 입력해 주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('mentoring_assignments')
      .update({
        mentor_name_raw: name.trim(),
        pm_note: pmNote.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);
    setSaving(false);
    if (error) {
      console.error('[mentor-portal] 정보 저장 실패:', error.message);
      toast.error('정보 저장에 실패했어요.');
      return;
    }
    setEditing(false);
    toast.success('정보가 저장됐어요.');
    onUpdated();
  }

  return (
    <section className="space-y-3">
      {/* 섹션 1 — 내 배정 정보 */}
      <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 text-violet-600">
              <User2 size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1E1B4B] truncate">
                {getMentorName(assignment)}
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${
                  assignment.status === '진행' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>{assignment.status}</span>
                <span>· {assignment.meet_type ?? '-'} · {assignment.pay_type ?? '-'}</span>
                {unregistered && (
                  <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-1 py-0.5">미등록</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-violet-100">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Users2 size={11} aria-hidden="true" /> 담당 멘티 ({mentees.length}명)
          </p>
          {mentees.length === 0 ? (
            <p className="text-xs text-slate-400 italic">아직 배정된 멘티가 없어요.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {mentees.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-1.5">
                  <p className="text-sm font-semibold text-slate-700">{m.name}</p>
                  {m.organization && <p className="text-[11px] text-slate-500">{m.organization}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 섹션 2 — 미등록 멘토 정보 등록 */}
      {unregistered && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-amber-800">내 정보 등록</p>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)}
                className="text-xs font-semibold text-amber-700 hover:underline">
                {assignment.mentor_name_raw ? '수정' : '등록하기'}
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600">이름</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동" disabled={saving}
                  className="w-full h-9 px-3 rounded-lg border border-amber-200 bg-white text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">메모 (선택)</label>
                <textarea value={pmNote} onChange={(e) => setPmNote(e.target.value)} rows={2}
                  placeholder="소속·연락처·전문분야 등을 자유롭게 적어 주세요." disabled={saving}
                  className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-sm focus:outline-none focus:border-amber-400 resize-none" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setEditing(false); setName(assignment.mentor_name_raw ?? ''); }}
                  className="px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100">취소</button>
                <button type="button" onClick={() => void handleSave()} disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  저장
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 whitespace-pre-wrap">
              {assignment.pm_note || (assignment.mentor_name_raw ? '메모가 비어 있어요.' : '먼저 이름과 정보를 등록해 주세요.')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
