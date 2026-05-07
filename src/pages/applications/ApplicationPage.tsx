// bal24 v2 — 교육생 신청 관리 (STEP 11 옵션 B)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Copy, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../contexts/ToastContext';
import { BADGE_BASE } from '../../utils/statusStyles';
import EmptyState from '../../components/EmptyState';
import type { ParticipantApplication, ParticipantStatus } from '../../types/application';
import type { Program } from '../../types/database';
import ApplicationDetailModal from './ApplicationDetailModal';

type FilterStatus = ParticipantStatus | 'ALL';

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  applied: '신청',
  reviewing: '검토중',
  accepted: '합격',
  rejected: '불합격',
  withdrawn: '취소',
  completed: '수료',
};

const STATUS_STYLE: Record<ParticipantStatus, string> = {
  applied: 'bg-slate-100 text-slate-600 border-slate-300',
  reviewing: 'bg-violet-50 text-violet-600 border-violet-200',
  accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-500 border-rose-200',
  withdrawn: 'bg-slate-100 text-slate-400 border-slate-300',
  completed: 'bg-cyan-50 text-cyan-600 border-cyan-200',
};

const FILTER_TABS: Array<{ value: FilterStatus; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'applied', label: '신청' },
  { value: 'reviewing', label: '검토중' },
  { value: 'accepted', label: '합격' },
  { value: 'rejected', label: '불합격' },
  { value: 'completed', label: '수료' },
];

export default function ApplicationPage() {
  const toast = useToast();
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [programFilter, setProgramFilter] = useState<string>('전체');
  const [items, setItems] = useState<ParticipantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [detailTarget, setDetailTarget] = useState<ParticipantApplication | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[applications] 프로그램 조회 실패:', error.message);
      setPrograms((data as Pick<Program, 'id' | 'name'>[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('participant_applications')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (programFilter !== '전체') {
        query = query.eq('program_id', programFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setItems((data as ParticipantApplication[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[applications] 조회 실패:', raw);
      toast.error('교육생 신청 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [programFilter, toast]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      reviewing: items.filter((a) => a.status === 'reviewing').length,
      accepted: items.filter((a) => a.status === 'accepted').length,
      rejected: items.filter((a) => a.status === 'rejected').length,
      completed: items.filter((a) => a.status === 'completed').length,
    };
  }, [items]);

  const visible = useMemo(() => {
    if (statusFilter === 'ALL') return items;
    return items.filter((a) => a.status === statusFilter);
  }, [items, statusFilter]);

  const handleStatusChange = async (id: string, status: ParticipantStatus) => {
    const { error } = await supabase
      .from('participant_applications')
      .update({ status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[applications] 상태 변경 실패:', error.message);
      toast.error('상태를 변경하지 못했어요.');
      return;
    }
    toast.success(`${STATUS_LABEL[status]} 상태로 변경했어요.`);
    void fetchItems();
  };

  const handleCopyLink = async (programId: string) => {
    const url = `${window.location.origin}/apply/${programId}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success('신청 링크를 복사했어요.');
    else toast.error('복사에 실패했어요. 직접 선택해서 복사해 주세요.');
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🙋</span>
        교육생 신청
      </h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500">프로그램 필터</label>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-w-[14rem]"
          >
            <option value="전체">전체 프로그램</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        {programFilter !== '전체' && (
          <Button variant="outline" onClick={() => void handleCopyLink(programFilter)}>
            <Copy size={14} className="mr-1.5" aria-hidden="true" />
            신청 링크 복사
          </Button>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: '총 신청', value: stats.total, tone: 'violet' },
          { label: '검토중', value: stats.reviewing, tone: 'violet' },
          { label: '합격', value: stats.accepted, tone: 'emerald' },
          { label: '불합격', value: stats.rejected, tone: 'rose' },
          { label: '수료', value: stats.completed, tone: 'cyan' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-violet-100 bg-white p-4">
            <div className="text-xs font-semibold text-slate-500 mb-1">{s.label}</div>
            <div className="text-2xl font-bold text-[#1E1B4B]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* 상태 필터 탭 */}
      <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
        {FILTER_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setStatusFilter(t.value)}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
              statusFilter === t.value ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🙋"
          title={statusFilter === 'ALL' ? '아직 신청자가 없어요.' : '조건에 맞는 신청자가 없어요.'}
          description={statusFilter === 'ALL' ? '신청 링크를 복사해서 공유해 보세요.' : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-x-auto shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <table className="w-full text-sm">
            <thead className="bg-violet-50/40 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">신청일</th>
                <th className="text-left px-4 py-2.5 font-semibold">이름</th>
                <th className="text-left px-4 py-2.5 font-semibold">연락처</th>
                <th className="text-left px-4 py-2.5 font-semibold">소속</th>
                <th className="text-center px-4 py-2.5 font-semibold">상태</th>
                <th className="text-center px-4 py-2.5 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((a) => (
                <tr key={a.id} className="hover:bg-violet-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDateKo(a.created_at)}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#1E1B4B]">{a.name}</td>
                  <td className="px-4 py-2.5 text-xs">{a.phone}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 truncate max-w-[180px]">{a.organization ?? '-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`${BADGE_BASE} ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <select
                        value={a.status}
                        onChange={(e) => void handleStatusChange(a.id, e.target.value as ParticipantStatus)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary"
                      >
                        {(Object.keys(STATUS_LABEL) as ParticipantStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setDetailTarget(a)}
                        aria-label="상세 보기"
                        className="rounded p-1.5 text-violet-600 hover:bg-violet-100 transition-colors"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailTarget && (
        <ApplicationDetailModal
          application={detailTarget}
          onClose={() => setDetailTarget(null)}
          onSaved={() => {
            setDetailTarget(null);
            void fetchItems();
          }}
        />
      )}

      <p className="text-xs text-slate-400 inline-flex items-center gap-1">
        <ExternalLink size={11} aria-hidden="true" />
        신청 페이지: /apply/&#123;프로그램ID&#125;
      </p>
    </div>
  );
}
