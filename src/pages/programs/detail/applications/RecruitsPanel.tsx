// bal24 v2 — 모집 공고·지원자 관리 패널 (Stage 11-③)
// recruit_forms (program_id) + recruit_applications (form_id) 합격/불합격.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Megaphone, ChevronDown, ChevronRight, ExternalLink, Copy, Search,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import { formatDateKo } from '../../../../lib/utils';
import { RECRUIT_TYPE_LABEL } from '../../../../types/application';
import type { RecruitForm } from '../../../../types/application';
import RecruitsApplicantList from './RecruitsApplicantList';
import BulkActionBar from '../../../../components/BulkActionBar';
import { useBulkSelect } from '../../../../hooks/useBulkSelect';

interface Props {
  programId: string;
}

type FormRow = Pick<
  RecruitForm,
  'id' | 'recruit_type' | 'title' | 'deadline' | 'is_active' | 'form_token' | 'max_count'
> & {
  application_count: number;
};

function buildRecruitUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/recruit/${token}`;
}

export default function RecruitsPanel({ programId }: Props) {
  const toast = useToast();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  // STEP-PARTICIPANT-BULK-DELETE — 검색 + 다중 선택
  const [search, setSearch] = useState('');
  const visible = search.trim()
    ? forms.filter((f) => f.title.toLowerCase().includes(search.trim().toLowerCase()))
    : forms;
  const { selectedIds, allSelected, toggleAll, toggleOne, clearSelection } = useBulkSelect(visible);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size}개 모집 공고와 지원자 정보를 모두 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('recruit_forms').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) {
      console.error('[recruits-panel] 일괄 삭제 실패:', error.message);
      toast.error('삭제 중 오류가 발생했어요.');
      return;
    }
    toast.success(`${ids.length}개 공고를 삭제했어요.`);
    clearSelection();
    void refresh();
  }

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('recruit_forms')
      .select(
        'id, recruit_type, title, deadline, is_active, form_token, max_count, applications:recruit_applications(id)',
      )
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[step-11/recruit] 모집 공고 조회 실패:', error.message);
      toast.error('모집 공고를 불러오지 못했어요.');
      return;
    }
    type Row = Omit<FormRow, 'application_count'> & { applications: { id: string }[] };
    setForms(((data as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      recruit_type: r.recruit_type,
      title: r.title,
      deadline: r.deadline,
      is_active: r.is_active,
      form_token: r.form_token,
      max_count: r.max_count,
      application_count: r.applications?.length ?? 0,
    })));
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, refresh]);

  async function handleCopy(token: string, label: string) {
    const ok = await copyToClipboard(buildRecruitUrl(token));
    if (ok) toast.success(`${label} 모집 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Megaphone size={16} className="text-orange-500" aria-hidden="true" />
          모집 공고 ({forms.length})
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* STEP-PARTICIPANT-BULK-DELETE — 검색 + 전체 선택 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="공고명 검색…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-violet-400" />
          </div>
          {visible.length > 0 && (
            <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600 focus:ring-violet-400" />
              전체 선택
            </label>
          )}
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          {forms.length === 0 ? '등록된 모집 공고가 없어요. 모집 메뉴에서 발행하세요.' : '검색 결과가 없어요.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((f) => {
            const isOpen = openFormId === f.id;
            return (
              <li key={f.id} className="rounded-xl border border-violet-100 bg-white overflow-hidden">
                <header className="flex items-center gap-2 px-3 py-2.5">
                  {/* STEP-PARTICIPANT-BULK-DELETE — 공고 선택 체크박스 */}
                  <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleOne(f.id)}
                    aria-label={`${f.title} 선택`}
                    className="w-3.5 h-3.5 shrink-0 rounded border-violet-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
                  <button type="button" onClick={() => setOpenFormId(isOpen ? null : f.id)}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-violet-600 hover:bg-violet-50"
                    aria-label={isOpen ? '접기' : '펼치기'}>
                    {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-700 shrink-0">
                    {RECRUIT_TYPE_LABEL[f.recruit_type]}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-[#1E1B4B]">{f.title}</span>
                  {f.deadline && (
                    <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                      ~ {formatDateKo(f.deadline).replace(/^\d{4}년\s/, '')}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                    지원 {f.application_count}{f.max_count != null ? `/${f.max_count}` : ''}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      f.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {f.is_active ? '진행중' : '종료'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(f.form_token, RECRUIT_TYPE_LABEL[f.recruit_type])}
                    title="모집 링크 복사"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <Copy size={12} aria-hidden="true" />
                  </button>
                  <a
                    href={buildRecruitUrl(f.form_token)}
                    target="_blank"
                    rel="noreferrer"
                    title="새 탭"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </header>

                {isOpen && <RecruitsApplicantList formId={f.id} />}
              </li>
            );
          })}
        </ul>
      )}

      {/* STEP-PARTICIPANT-BULK-DELETE — 하단 fixed 액션 바 */}
      <BulkActionBar count={selectedIds.size} busy={bulkDeleting} itemLabel="개"
        onDelete={() => void handleBulkDelete()} onCancel={clearSelection}
        deleteLabel="공고 삭제" />
    </div>
  );
}

