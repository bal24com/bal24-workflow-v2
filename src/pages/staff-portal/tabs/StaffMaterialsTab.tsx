// bal24 v2 — STEP-STAFF-PORTAL-P4
// 강사 포털 · 자료 탭 — 강사가 받은 강의 자료 (instructor_invitations.materials).
// 차시별 자료 업로드 테이블은 v2에 없음 → "준비 중" 안내.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Download, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { InvitationFile } from '../../../types/database';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props { staff: StaffPortalIdentity }

interface InvitationMaterials {
  id: string;
  program_id: string | null;
  program_name: string | null;
  materials: InvitationFile[];
}

export default function StaffMaterialsTab({ staff }: Props) {
  const [items, setItems] = useState<InvitationMaterials[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
    const { data, error } = await supabase.from('instructor_invitations')
      .select('id, program_id, materials, program:programs!instructor_invitations_program_id_fkey(name)')
      .eq(staffCol, staff.id)
      .eq('status', '수락');   // 수락된 초대의 자료만
    if (error) { console.warn('[staff-portal/materials] 조회 경고:', error.message); setItems([]); setLoading(false); return; }
    type Row = { id: string; program_id: string | null; materials: InvitationFile[] | null; program: { name: string } | null };
    const rows = ((data ?? []) as unknown) as Row[];
    setItems(
      rows
        .filter((r) => Array.isArray(r.materials) && r.materials.length > 0)
        .map((r) => ({
          id: r.id,
          program_id: r.program_id,
          program_name: r.program?.name ?? null,
          materials: r.materials ?? [],
        })),
    );
    setLoading(false);
  }, [staff.id, staff.sourceType]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 px-4 py-3 text-xs text-cyan-800 flex items-start gap-2">
        <Info size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          PM이 강사 초대 시 첨부한 강의 자료가 표시돼요.
          본인 자료 업로드 기능은 향후 단계에서 제공될 예정이에요.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic bg-white rounded-xl border border-slate-100 px-4 py-8 text-center">
          받은 강의 자료가 없어요.
        </p>
      ) : (
        items.map((g) => (
          <section key={g.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-bold text-[#1E1B4B] mb-2">{g.program_name ?? '(프로그램 미지정)'}</p>
            <ul className="space-y-1.5">
              {g.materials.map((m, idx) => (
                <li key={idx} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-violet-50/30 px-3 py-2">
                  <FileText size={14} className="shrink-0 text-violet-500" aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-700">{m.name}</span>
                  <a href={m.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700">
                    <Download size={11} aria-hidden="true" /> 다운로드
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
