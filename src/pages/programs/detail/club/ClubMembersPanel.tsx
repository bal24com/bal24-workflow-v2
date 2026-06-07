// 박경수님 2026-06-08 CLUB-A — 팀원 개별 명단 관리 패널
// program_club_members 테이블 CRUD (이름·학년·역할·연락처)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Users2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import type { ProgramClubMember } from '../../../../types/database';

interface Props {
  clubId: string;
  clubName: string;
  canEdit: boolean;
}

const ROLE_OPTIONS = ['팀장', '팀원', '부팀장'];

export default function ClubMembersPanel({ clubId, clubName, canEdit }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ProgramClubMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', grade: '', role: '팀원', phone: '' });

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_club_members')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at');
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes('could not find') || m.includes('pgrst205')) {
        toast.error('팀원 테이블이 아직 없어요. SQL 마이그레이션을 실행해 주세요.');
      } else {
        console.error('[ClubMembersPanel] 조회:', error.message);
      }
      setLoading(false); return;
    }
    setMembers((data ?? []) as ProgramClubMember[]);
    setLoading(false);
  }, [clubId, toast]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  async function handleAdd() {
    if (!form.name.trim()) { toast.error('이름을 입력해 주세요.'); return; }
    setAdding(true);
    const { error } = await supabase.from('program_club_members').insert({
      club_id: clubId,
      name: form.name.trim(),
      grade: form.grade.trim() || null,
      role: form.role || '팀원',
      phone: form.phone.trim() || null,
    });
    setAdding(false);
    if (error) { console.error('[ClubMembersPanel] 추가:', error.message); toast.error('추가 실패'); return; }
    toast.success(`${form.name} 팀원을 추가했어요.`);
    setForm({ name: '', grade: '', role: '팀원', phone: '' });
    void reload();
  }

  async function handleDelete(m: ProgramClubMember) {
    if (!window.confirm(`"${m.name}" 팀원을 삭제할까요?`)) return;
    const { error } = await supabase.from('program_club_members').delete().eq('id', m.id);
    if (error) { toast.error('삭제 실패'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/50">
      {/* 토글 헤더 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Users2 size={13} className="text-violet-600 shrink-0" aria-hidden="true" />
        <span className="text-[12px] font-bold text-slate-700 flex-1">
          팀원 명단 {members.length > 0 && !loading ? `(${members.length}명)` : ''}
        </span>
        {open ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={15} className="animate-spin text-violet-400" aria-hidden="true" />
            </div>
          ) : (
            <>
              {/* 목록 */}
              {members.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-3">
                  아직 등록된 팀원이 없어요.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {members.map((mem) => (
                    <li key={mem.id} className="flex items-center gap-2 py-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        mem.role === '팀장' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                      }`}>{mem.role ?? '팀원'}</span>
                      <span className="text-xs font-bold text-[#1E1B4B] flex-1 min-w-0 truncate">{mem.name}</span>
                      {mem.grade && <span className="text-[11px] text-slate-500 shrink-0">{mem.grade}</span>}
                      {mem.phone && <span className="text-[11px] text-slate-400 shrink-0">{mem.phone}</span>}
                      {canEdit && (
                        <button type="button" onClick={() => void handleDelete(mem)}
                          className="p-1 rounded hover:bg-rose-50 text-rose-400 shrink-0">
                          <Trash2 size={11} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* 추가 폼 */}
              {canEdit && (
                <div className="rounded-lg border border-violet-100 bg-white p-2 space-y-2">
                  <p className="text-[10px] font-bold text-violet-700">팀원 추가 — {clubName}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text" value={form.name} placeholder="이름 *"
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="col-span-2 h-8 px-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-violet-400"
                    />
                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="h-8 px-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-violet-400"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input
                      type="text" value={form.grade} placeholder="학년 (예: 3학년)"
                      onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                      className="h-8 px-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-violet-400"
                    />
                    <input
                      type="text" value={form.phone} placeholder="연락처"
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="col-span-2 h-8 px-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-violet-400"
                    />
                  </div>
                  <button
                    type="button" onClick={() => void handleAdd()} disabled={adding || !form.name.trim()}
                    className="w-full inline-flex items-center justify-center gap-1 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50"
                  >
                    {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    팀원 추가
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
