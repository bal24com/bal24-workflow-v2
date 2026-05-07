// bal24 v2 — 강사·TA 모집 공고 관리 (STEP 11 옵션 B)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Copy, Pencil, Eye, Power } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../contexts/ToastContext';
import { BADGE_BASE } from '../../utils/statusStyles';
import EmptyState from '../../components/EmptyState';
import {
  RECRUIT_TYPE_LABEL,
  type RecruitForm,
  type RecruitApplication,
  type RecruitApplicationStatus,
  type RecruitType,
} from '../../types/application';
import RecruitFormModal from './RecruitFormModal';
import RecruitApplicantsPanel from './RecruitApplicantsPanel';

const TYPE_STYLE: Record<RecruitType, string> = {
  instructor: 'bg-violet-50 text-violet-600 border-violet-200',
  ta: 'bg-orange-50 text-orange-500 border-orange-200',
  expert: 'bg-cyan-50 text-cyan-500 border-cyan-200',
  mentor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

interface RecruitRow extends RecruitForm {
  applications: { id: string; status: RecruitApplicationStatus }[];
}

const SELECT_COLUMNS = '*, applications:recruit_applications(id, status)';

export default function RecruitPage() {
  const toast = useToast();
  const [items, setItems] = useState<RecruitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecruitForm | null>(null);
  const [activeForm, setActiveForm] = useState<RecruitRow | null>(null);
  const [applicants, setApplicants] = useState<RecruitApplication[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recruit_forms')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as RecruitRow[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[recruit] 조회 실패:', raw);
      toast.error('모집 공고 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!activeForm) {
      setApplicants([]);
      return;
    }
    let cancelled = false;
    setLoadingApplicants(true);
    void (async () => {
      const { data, error } = await supabase
        .from('recruit_applications')
        .select('*')
        .eq('form_id', activeForm.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[recruit] 지원자 조회 실패:', error.message);
        toast.error('지원자 목록을 불러오지 못했어요.');
      }
      setApplicants((data as RecruitApplication[] | null) ?? []);
      setLoadingApplicants(false);
    })();
    return () => { cancelled = true; };
  }, [activeForm, toast]);

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/recruit/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success('모집 링크를 복사했어요.');
    else toast.error('복사에 실패했어요. 직접 선택해서 복사해 주세요.');
  };

  const handleToggleActive = async (form: RecruitForm) => {
    const next = !form.is_active;
    const { error } = await supabase
      .from('recruit_forms')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', form.id);
    if (error) {
      console.error('[recruit] 활성 토글 실패:', error.message);
      toast.error('상태 변경 중 오류가 발생했어요.');
      return;
    }
    toast.success(next ? '모집을 다시 활성화했어요.' : '모집을 비활성화했어요.');
    void fetchItems();
  };

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.is_active).length,
    totalApplicants: items.reduce((s, i) => s + i.applications.length, 0),
  }), [items]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">📝</span>
        모집 공고
      </h1>

      <div className="flex items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1 max-w-md">
          <Stat label="전체 공고" value={stats.total} />
          <Stat label="진행 중" value={stats.active} />
          <Stat label="총 지원자" value={stats.totalApplicants} />
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-1.5" aria-hidden="true" />
          공고 등록
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="아직 등록된 모집 공고가 없어요."
          description="첫 모집 공고를 만들어 보세요."
          action={
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              + 공고 등록
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((f) => {
            const applicantCount = f.applications.length;
            const reachedDeadline = f.deadline && new Date(f.deadline) < new Date(new Date().toDateString());
            return (
              <article
                key={f.id}
                className={`rounded-2xl border p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] transition ${
                  f.is_active ? 'bg-white border-violet-100 hover:border-violet-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`${BADGE_BASE} ${TYPE_STYLE[f.recruit_type]}`}>
                        {RECRUIT_TYPE_LABEL[f.recruit_type]}
                      </span>
                      {!f.is_active && (
                        <span className={`${BADGE_BASE} bg-slate-100 text-slate-500 border-slate-300`}>
                          비활성
                        </span>
                      )}
                      {reachedDeadline && f.is_active && (
                        <span className={`${BADGE_BASE} bg-rose-50 text-rose-600 border-rose-200`}>
                          마감
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[#1E1B4B] truncate">{f.title}</h3>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500 mb-3">
                  {f.deadline && <div>마감 {formatDateKo(f.deadline)}</div>}
                  {f.max_count != null && <div>{f.max_count}명 모집</div>}
                  <div className="font-semibold text-violet-700">지원 {applicantCount}건</div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setActiveForm(f)}>
                    <Eye size={14} className="mr-1" aria-hidden="true" />
                    지원자
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleCopyLink(f.form_token)}>
                    <Copy size={14} className="mr-1" aria-hidden="true" />
                    링크
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditTarget(f)}>
                    <Pencil size={14} className="mr-1" aria-hidden="true" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleToggleActive(f)}
                    className={f.is_active ? '' : '!border-emerald-200 !text-emerald-600'}
                  >
                    <Power size={14} className="mr-1" aria-hidden="true" />
                    {f.is_active ? '비활성' : '활성'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {createOpen && (
        <RecruitFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            void fetchItems();
          }}
        />
      )}
      {editTarget && (
        <RecruitFormModal
          editTarget={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            void fetchItems();
          }}
        />
      )}
      {activeForm && (
        <RecruitApplicantsPanel
          form={activeForm}
          applicants={applicants}
          loading={loadingApplicants}
          onClose={() => setActiveForm(null)}
          onUpdated={() => {
            // 지원자 상태 변경 후 재조회
            const f = activeForm;
            setActiveForm(null);
            setTimeout(() => setActiveForm(f), 50);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-3">
      <div className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className="text-xl font-bold text-[#1E1B4B]">{value}</div>
    </div>
  );
}
