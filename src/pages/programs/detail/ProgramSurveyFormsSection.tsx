// 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 프로그램 설문 정의 목록·관리 섹션.
// 만족도 탭 안에서 동적 설문 (사전 수요조사 등) 을 만들고 4역할 외부 응답을 받음.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Edit3, ClipboardList, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import {
  SURVEY_FORM_KIND_LABEL,
  type ProgramSurveyForm,
} from '../../../types/database';
import SurveyFormCreateModal from './SurveyFormCreateModal';
import SurveyResponsesPanel from './SurveyResponsesPanel';

interface Props {
  programId: string;
  canEdit: boolean;
}

const TARGET_LABEL: Record<string, string> = {
  supporter:   '지원기관',
  beneficiary: '수혜기관',
  team:        '참여팀(개인)',
  staff:       '강사/멘토',
};

export default function ProgramSurveyFormsSection({ programId, canEdit }: Props) {
  const toast = useToast();
  const [forms, setForms] = useState<ProgramSurveyForm[]>([]);
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramSurveyForm | null>(null);
  // 박경수님 2026-06-02 STEP-SURVEY-RESULTS-A — 응답 상세 패널 대상
  const [responsesTarget, setResponsesTarget] = useState<ProgramSurveyForm | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const fRes = await supabase
      .from('program_survey_forms')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    if (fRes.error) {
      console.error('[ProgramSurveyFormsSection] 설문 조회 실패:', fRes.error.message);
      // 테이블 미적용 케이스 — 안내문 표시
      const m = fRes.error.message.toLowerCase();
      if (m.includes('could not find the table') || m.includes('pgrst205')) {
        toast.error('설문 테이블이 아직 적용되지 않았어요. SQL을 먼저 실행해 주세요.');
      } else {
        toast.error('설문을 불러오지 못했어요.');
      }
      setForms([]);
      setResponseCounts(new Map());
      setLoading(false);
      return;
    }
    const list = (fRes.data ?? []) as ProgramSurveyForm[];
    setForms(list);

    // 응답 개수 별도 fetch (form_id 컬럼 사용)
    if (list.length > 0) {
      const rRes = await supabase
        .from('survey_responses')
        .select('form_id')
        .in('form_id', list.map((f) => f.id));
      if (!rRes.error) {
        const map = new Map<string, number>();
        (rRes.data ?? []).forEach((row) => {
          const fid = (row as { form_id: string | null }).form_id;
          if (fid) map.set(fid, (map.get(fid) ?? 0) + 1);
        });
        setResponseCounts(map);
      }
    } else {
      setResponseCounts(new Map());
    }
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleDelete(f: ProgramSurveyForm) {
    if (!window.confirm(`"${f.title}" 설문을 삭제할까요? 응답도 함께 삭제돼요.`)) return;
    const { error } = await supabase.from('program_survey_forms').delete().eq('id', f.id);
    if (error) { console.error('[ProgramSurveyFormsSection] 삭제 실패:', error.message); toast.error('삭제 실패'); return; }
    toast.success('설문을 삭제했어요.');
    void reload();
  }

  async function toggleActive(f: ProgramSurveyForm) {
    const { error } = await supabase
      .from('program_survey_forms')
      .update({ is_active: !f.is_active, updated_at: new Date().toISOString() })
      .eq('id', f.id);
    if (error) { console.error('[ProgramSurveyFormsSection] 활성 토글:', error.message); toast.error('변경 실패'); return; }
    toast.success(f.is_active ? '비활성으로 전환했어요.' : '활성으로 전환했어요.');
    void reload();
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5 space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            <ClipboardList size={14} className="text-violet-600" aria-hidden="true" />
            설문 조사 ({forms.length})
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            동적 설문을 만들어 외부 4역할(지원기관·수혜기관·참여팀·강사/멘토) 토큰 페이지에서 응답받아요.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
            <Plus size={12} aria-hidden="true" /> 새 설문 만들기
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : forms.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-6 border border-dashed border-slate-200 rounded-lg">
          아직 설문이 없어요. {canEdit && '[+ 새 설문 만들기] 로 시작하세요.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {forms.map((f) => {
            const count = responseCounts.get(f.id) ?? 0;
            return (
              <li key={f.id}
                className={`flex items-start gap-2 p-3 rounded-xl border ${
                  f.is_active ? 'border-violet-100 bg-violet-50/30' : 'border-slate-200 bg-slate-50 opacity-70'
                }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[#1E1B4B] truncate">{f.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                      {SURVEY_FORM_KIND_LABEL[f.kind] ?? f.kind}
                    </span>
                    {!f.is_active && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">비활성</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                    <span><strong>{f.questions.length}</strong>문항</span>
                    <button type="button" onClick={() => setResponsesTarget(f)}
                      className="inline-flex items-center gap-0.5 hover:underline">
                      응답 <strong className="text-violet-700">{count}</strong>건
                    </button>
                    <span className="inline-flex items-center gap-1">
                      <Users size={10} aria-hidden="true" />
                      대상 {f.target_audiences.length === 0 ? '미지정' : f.target_audiences.map((t) => TARGET_LABEL[t] ?? t).join('·')}
                    </span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => void toggleActive(f)}
                      title={f.is_active ? '비활성으로' : '활성으로'}
                      className={`px-2 h-7 rounded-lg text-[10px] font-bold ${
                        f.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                      }`}>
                      {f.is_active ? '끄기' : '켜기'}
                    </button>
                    <button type="button" onClick={() => { setEditing(f); setModalOpen(true); }}
                      title="수정" className="p-1 rounded hover:bg-white text-slate-500">
                      <Edit3 size={12} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => void handleDelete(f)}
                      title="삭제" className="p-1 rounded hover:bg-rose-50 text-rose-500">
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <SurveyFormCreateModal
          programId={programId}
          form={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); void reload(); }}
        />
      )}

      {/* 박경수님 2026-06-02 STEP-SURVEY-RESULTS-A — 응답 상세 패널 */}
      {responsesTarget && (
        <SurveyResponsesPanel
          form={responsesTarget}
          onClose={() => setResponsesTarget(null)}
        />
      )}
    </section>
  );
}
