// 포털 개요 정보 편집기 — 설정·공유 탭 (편집) & SchoolOverviewTab (조회) 공용.
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN PART C.

import { useCallback, useEffect, useState } from 'react';
import { Edit, Save, X, Loader2, BookOpen } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { getPortalIntro, savePortalIntro, type PortalIntro } from '../../hooks/portal/usePortalAdmin';

interface Props {
  programId: string;
  editable: boolean;          // true = PM 편집 가능 / false = 조회 전용
  defaultEditing?: boolean;
}

const FIELDS: Array<{ key: keyof PortalIntro; label: string; placeholder: string; multiline?: boolean }> = [
  { key: 'operator',   label: '운영 주관',     placeholder: '예) (주)밸런스닷' },
  { key: 'purpose',    label: '사업 목적',     placeholder: '청소년 창업 역량 강화 등', multiline: true },
  { key: 'schedule',   label: '전체 일정',     placeholder: '예) 1차 5/13 · 2차 6월 · 3차 9월 · 4차 10월 · 성과공유회 11/9', multiline: true },
  { key: 'pm_contact', label: 'PM 연락처',     placeholder: '예) 010-4433-2341 (박경수)' },
  { key: 'inquiry',    label: '운영기관 문의', placeholder: '예) 여수교육지원청 교육지원과 061-690-5523' },
];

export default function PortalIntroEditor({ programId, editable, defaultEditing = false }: Props) {
  const toast = useToast();
  const [intro, setIntro] = useState<PortalIntro>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(defaultEditing);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PortalIntro>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const { intro: data } = await getPortalIntro(programId);
    setIntro(data);
    setDraft(data);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const startEdit = () => {
    setDraft(intro);
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(intro);
    setEditing(false);
  };
  const handleSave = async () => {
    setSaving(true);
    const res = await savePortalIntro(programId, draft);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setIntro(draft);
    setEditing(false);
    toast.success('사업 개요를 저장했어요.');
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-violet-500" size={20} /></div>;
  }

  const filledEntries = (Object.keys(intro) as Array<keyof PortalIntro>)
    .filter((k) => (intro[k] ?? '').toString().trim().length > 0);

  // ─── 조회 전용 모드 ─────────────────────
  if (!editing) {
    return (
      <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
            <BookOpen size={16} className="text-violet-500" aria-hidden="true" /> 사업 개요
          </h2>
          {editable && (
            <button type="button" onClick={startEdit}
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded bg-violet-50 text-violet-700 hover:bg-violet-100">
              <Edit size={12} /> 수정
            </button>
          )}
        </div>
        {filledEntries.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">
            {editable ? '[수정] 버튼으로 사업 개요를 입력하세요.' : '아직 등록된 사업 개요가 없어요.'}
          </p>
        ) : (
          <dl className="space-y-2">
            {FIELDS.map((f) => {
              const v = (intro[f.key] ?? '').toString().trim();
              if (!v) return null;
              return (
                <div key={f.key} className="grid grid-cols-[110px_1fr] gap-3 text-sm">
                  <dt className="text-slate-500 font-semibold">{f.label}</dt>
                  <dd className="text-slate-800 whitespace-pre-wrap">{v}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>
    );
  }

  // ─── 편집 모드 ──────────────────────────
  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
      <h2 className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
        <BookOpen size={16} className="text-violet-500" aria-hidden="true" /> 사업 개요 편집
      </h2>
      <div className="space-y-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-bold text-slate-600 mb-1">{f.label}</label>
            {f.multiline ? (
              <textarea value={String(draft[f.key] ?? '')}
                onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none" />
            ) : (
              <input value={String(draft[f.key] ?? '')}
                onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={cancelEdit} disabled={saving}
          className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">
          <X size={12} /> 취소
        </button>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 저장하기
        </button>
      </div>
    </section>
  );
}
