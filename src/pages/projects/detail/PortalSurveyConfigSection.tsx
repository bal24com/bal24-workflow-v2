// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE — 설문 설정 섹션.
// 참여 일정 옵션 + 설문 필드 체크 → project_portals.survey_config 저장.

import { useState } from 'react';
import { Save, Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

export interface SurveyConfig {
  schedule_options?: string[];
  fields?: string[];
}

const DEFAULT_FIELDS = ['희망일정', '참여인원', '담당자명', '연락처'] as const;

interface Props {
  portalId: string;
  surveyConfig: SurveyConfig;
  onSaved: () => void;
}

export default function PortalSurveyConfigSection({ portalId, surveyConfig, onSaved }: Props) {
  const toast = useToast();
  const [schedules, setSchedules] = useState<string[]>(surveyConfig.schedule_options ?? []);
  const [newSchedule, setNewSchedule] = useState('');
  const [fields, setFields] = useState<string[]>(
    surveyConfig.fields && surveyConfig.fields.length > 0
      ? surveyConfig.fields
      : [...DEFAULT_FIELDS],
  );
  const [saving, setSaving] = useState(false);

  function addSchedule() {
    const v = newSchedule.trim();
    if (!v) return;
    if (schedules.includes(v)) { toast.error('이미 추가된 일정이에요.'); return; }
    setSchedules([...schedules, v].sort());
    setNewSchedule('');
  }

  function removeSchedule(s: string) {
    setSchedules(schedules.filter((x) => x !== s));
  }

  function toggleField(f: string) {
    setFields(fields.includes(f) ? fields.filter((x) => x !== f) : [...fields, f]);
  }

  async function handleSave() {
    setSaving(true);
    const config: SurveyConfig = {
      schedule_options: schedules,
      fields,
    };
    const { error } = await supabase
      .from('project_portals')
      .update({ survey_config: config })
      .eq('id', portalId);
    setSaving(false);
    if (error) {
      console.error('[PortalSurveyConfigSection] 저장 실패:', error.message);
      toast.error('설문 설정 저장 실패');
      return;
    }
    toast.success('설문 설정을 저장했어요.');
    onSaved();
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-[#1E1B4B]">📝 신청 설문 설정</h3>

      {/* 참여 일정 */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
        <p className="text-[11px] font-bold text-violet-700">참여 가능 일정 옵션</p>
        <div className="flex items-center gap-2">
          <input type="date" value={newSchedule} onChange={(e) => setNewSchedule(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-violet-500" />
          <button type="button" onClick={addSchedule}
            className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200">
            <Plus size={12} aria-hidden="true" /> 추가
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {schedules.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">일정 옵션이 없어요. 신청자가 일정을 선택할 수 없어요.</span>
          ) : schedules.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-violet-100 text-violet-700">
              {s}
              <button type="button" onClick={() => removeSchedule(s)} aria-label={`${s} 삭제`}
                className="hover:text-rose-500"><X size={11} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      </div>

      {/* 설문 필드 */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
        <p className="text-[11px] font-bold text-violet-700">설문 항목 선택</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {DEFAULT_FIELDS.map((f) => (
            <label key={f} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
              <input type="checkbox" checked={fields.includes(f)} onChange={() => toggleField(f)}
                className="rounded text-violet-600" />
              {f}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">
          체크된 항목만 수혜기관 신청 설문에 표시돼요.
        </p>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden="true" />}
          설문 설정 저장
        </button>
      </div>
    </section>
  );
}
