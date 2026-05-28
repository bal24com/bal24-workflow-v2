// 컨소시엄 참여사 ↔ 프로그램 다대다 배정 탭.
// 박경수님 2026-05-28 STEP-CONSORTIUM-PROGRAM-ASSIGN.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Briefcase } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
  consortiumId: string;
  projectId: string | null;
}

interface ProgramRow { id: string; name: string }
interface MemberRow { id: string; label: string; is_self: boolean }
interface AssignRow {
  program_id: string;
  program_name: string;
  consortium_member_id: string | null;
  role: '주관' | '수행사' | '협력';
  assignment_id: string | null;
}

interface MemberRaw {
  id: string;
  org_name: string | null;
  is_self: boolean | null;
  clients: { name: string } | { name: string }[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function ConProgramAssignTab({ consortiumId, projectId }: Props) {
  const toast = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rows, setRows] = useState<AssignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1) 컨소시엄 참여사 + 자사 이름
      const { data: mems, error: mErr } = await supabase
        .from('consortium_members')
        .select('id, org_name, is_self, clients!consortium_members_client_id_fkey(name)')
        .eq('consortium_id', consortiumId);
      if (mErr) console.error('[ConProgramAssignTab] 참여사 조회:', mErr.message);
      const memberRows: MemberRow[] = ((mems ?? []) as MemberRaw[]).map((r) => {
        const c = pickOne(r.clients);
        return {
          id: r.id,
          label: r.org_name || c?.name || '미지정',
          is_self: !!r.is_self,
        };
      });
      setMembers(memberRows);

      // 2) 프로젝트의 프로그램 목록 (project_id NULL 이면 컨소시엄 직속 프로그램 fallback)
      let progRes;
      if (projectId) {
        progRes = await supabase
          .from('programs')
          .select('id, name')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });
      } else {
        progRes = await supabase
          .from('programs')
          .select('id, name')
          .eq('consortium_id', consortiumId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });
      }
      if (progRes.error) console.error('[ConProgramAssignTab] 프로그램 조회:', progRes.error.message);
      const programs = (progRes.data ?? []) as ProgramRow[];

      // 3) 기존 배정 현황
      if (programs.length === 0) {
        setRows([]);
        return;
      }
      const programIds = programs.map((p) => p.id);
      const { data: assigns, error: aErr } = await supabase
        .from('program_assignments')
        .select('id, program_id, consortium_member_id, role')
        .in('program_id', programIds);
      if (aErr) console.error('[ConProgramAssignTab] 배정 조회:', aErr.message);

      const assignMap = new Map<string, { id: string; member: string; role: string }>();
      for (const a of (assigns ?? []) as Array<{ id: string; program_id: string; consortium_member_id: string; role: string }>) {
        assignMap.set(a.program_id, { id: a.id, member: a.consortium_member_id, role: a.role });
      }
      setRows(programs.map((p) => {
        const ex = assignMap.get(p.id);
        return {
          program_id: p.id,
          program_name: p.name,
          consortium_member_id: ex?.member ?? null,
          role: (ex?.role as '주관' | '수행사' | '협력') ?? '수행사',
          assignment_id: ex?.id ?? null,
        };
      }));
    } finally {
      setLoading(false);
    }
  }, [consortiumId, projectId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const updateRow = (programId: string, patch: Partial<AssignRow>) => {
    setRows((prev) => prev.map((r) => (r.program_id === programId ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        // 미배정 (member null) + 기존 배정 있음 → 삭제
        if (!row.consortium_member_id && row.assignment_id) {
          const { error } = await supabase.from('program_assignments').delete().eq('id', row.assignment_id);
          if (error) console.error('[ConProgramAssignTab] 삭제:', error.message);
          continue;
        }
        if (!row.consortium_member_id) continue;
        const payload = {
          program_id: row.program_id,
          consortium_member_id: row.consortium_member_id,
          role: row.role,
        };
        if (row.assignment_id) {
          const { error } = await supabase
            .from('program_assignments')
            .update(payload)
            .eq('id', row.assignment_id);
          if (error) console.error('[ConProgramAssignTab] 수정:', error.message);
        } else {
          const { error } = await supabase.from('program_assignments').insert(payload);
          if (error) console.error('[ConProgramAssignTab] 추가:', error.message);
        }
      }
      toast.success('참여사 배정을 저장했어요.');
      await loadData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[ConProgramAssignTab] 저장 오류:', raw);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>;
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-slate-800 inline-flex items-center gap-1.5">
          <Briefcase size={16} className="text-violet-500" aria-hidden="true" />
          프로그램별 참여사 배정 ({rows.length}개 프로그램)
        </h2>
        <button type="button" onClick={() => void handleSave()} disabled={saving || rows.length === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          저장하기
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">
          등록된 프로그램이 없어요. 프로젝트 또는 컨소시엄에 프로그램을 먼저 등록하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-violet-50/50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">프로그램</th>
                <th className="text-left px-3 py-2 font-semibold">담당 참여사</th>
                <th className="text-left px-3 py-2 font-semibold">역할</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.program_id} className="hover:bg-violet-50/30">
                  <td className="px-3 py-2 font-medium text-slate-800">{r.program_name}</td>
                  <td className="px-3 py-2">
                    <select value={r.consortium_member_id ?? ''}
                      onChange={(e) => updateRow(r.program_id, { consortium_member_id: e.target.value || null })}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                      <option value="">— 미배정 —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.is_self ? `${m.label} [자사]` : m.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={r.role}
                      onChange={(e) => updateRow(r.program_id, { role: e.target.value as AssignRow['role'] })}
                      className="border border-slate-300 rounded px-2 py-1 text-sm">
                      <option value="주관">주관</option>
                      <option value="수행사">수행사</option>
                      <option value="협력">협력</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        💡 미배정으로 변경 후 저장하면 기존 배정이 삭제돼요. PM/관리자만 수정 가능합니다.
      </p>
    </section>
  );
}
