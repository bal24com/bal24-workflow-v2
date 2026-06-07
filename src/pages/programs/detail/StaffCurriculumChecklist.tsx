// bal24 v2 — STEP-STAFF-ASSIGNMENT-FEE
// 강사 카드 펼침 시 표시되는 차시 체크리스트
// 각 차시: 완료 체크 + 실제 강의자 선택 (배정 강사 또는 다른 강사)

import { useState } from 'react';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import {
  setCurriculumCompleted, setActualInstructor,
  type CurriculumLite, type StaffActivity,
} from './staffActivityUtils';

interface Props {
  staff: StaffActivity;
  allStaff: StaffActivity[];       // 실제 강의자 선택 드롭다운 옵션
  onChanged: () => void;
}

function timeRange(c: CurriculumLite): string {
  if (!c.start_time && !c.end_time) return '';
  return `${(c.start_time ?? '').slice(0, 5)}~${(c.end_time ?? '').slice(0, 5)}`;
}

export default function StaffCurriculumChecklist({ staff, allStaff, onChanged }: Props) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  // 실제 강의자 옵션 (staff_pool_id가 있는 강사만 ID 매칭 가능)
  const instructorOptions = allStaff
    .filter((s) => s.staff_pool_id || s.profile_id)
    .map((s) => ({
      id: s.staff_pool_id ?? s.profile_id ?? '',
      name: s.name,
    }));

  async function toggle(c: CurriculumLite) {
    setBusyId(c.id);
    const ok = await setCurriculumCompleted(c.id, !c.is_completed);
    setBusyId(null);
    if (!ok) { toast.error('완료 처리에 실패했어요.'); return; }
    toast.success(c.is_completed ? '완료 해제됐어요.' : '완료 처리됐어요.');
    onChanged();
  }

  async function changeActual(c: CurriculumLite, newId: string) {
    setBusyId(c.id);
    const ok = await setActualInstructor(c.id, newId || null);
    setBusyId(null);
    if (!ok) { toast.error('실제 강의자 변경에 실패했어요.'); return; }
    toast.success('실제 강의자가 변경됐어요.');
    onChanged();
  }

  if (staff.curriculums.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic py-3 text-center">
        배정된 차시가 없어요. 커리큘럼 탭에서 차시별 강사를 등록해 주세요.
      </p>
    );
  }

  const defaultId = staff.staff_pool_id ?? staff.profile_id ?? '';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-violet-50/40 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-center font-bold w-12">차시</th>
            <th className="px-2 py-1.5 text-left font-bold">주제</th>
            <th className="px-2 py-1.5 text-left font-bold whitespace-nowrap">일정</th>
            <th className="px-2 py-1.5 text-left font-bold whitespace-nowrap">실제 강의자</th>
            <th className="px-2 py-1.5 text-center font-bold w-16">완료</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {staff.curriculums.map((c) => {
            const meta = [c.day_label, c.session_date ? formatDateKo(c.session_date) : null]
              .filter(Boolean).join(' · ');
            const tr = timeRange(c);
            return (
              <tr key={c.id} className={c.is_completed ? 'bg-emerald-50/30' : 'hover:bg-violet-50/20'}>
                <td className="px-2 py-1.5 text-center tabular-nums font-bold text-violet-700">
                  {c.session_no}
                </td>
                <td className="px-2 py-1.5 text-slate-700 truncate max-w-[200px]">
                  {c.title}
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-500 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {meta && (
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar size={10} aria-hidden="true" /> {meta}
                      </span>
                    )}
                    {tr && (
                      <span className="inline-flex items-center gap-0.5 tabular-nums">
                        <Clock size={10} aria-hidden="true" /> {tr}
                      </span>
                    )}
                    {!meta && !tr && <span className="text-slate-300 italic">일정 미지정</span>}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={c.actual_instructor_id ?? defaultId}
                    disabled={busyId === c.id || instructorOptions.length === 0}
                    onChange={(e) => void changeActual(c, e.target.value)}
                    className="h-7 px-1.5 rounded border border-violet-200 text-[11px] bg-white focus:outline-none focus:border-violet-500 max-w-[140px]"
                  >
                    {instructorOptions.length === 0 && (
                      <option value="">{staff.name}</option>
                    )}
                    {instructorOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button type="button" disabled={busyId === c.id}
                    onClick={() => void toggle(c)}
                    aria-label={c.is_completed ? '완료 해제' : '완료 처리'}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                      c.is_completed
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'
                    } disabled:opacity-50`}>
                    <CheckCircle2 size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
