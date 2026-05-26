// bal24 v2 — 프로젝트 상세 · 프로그램 탭 (project_id 기준 프로그램 목록)

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Calendar, MapPin, Users } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import { BADGE_BASE, PROGRAM_STATUS_STYLE, PROGRAM_TYPE_STYLE } from '../../../utils/statusStyles';
import EmptyState from '../../../components/EmptyState';
import ProgramFormModal from '../../programs/ProgramFormModal';
import type { Program } from '../../../types/database';

interface Props {
  projectId: string;
  // 박경수님 + SkyClaw STEP-ESTIMATE-UPGRADE-FULL PART E (2026-05-28) — 프로그램 신규 등록 시 프로젝트명 자동 prefill
  projectName?: string;
}

export default function ProjectProgramsTab({ projectId, projectName }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    // STEP-TRASH-FILTER-AUDIT — 휴지통 프로그램 제외 (ProgramsPage 와 동일)
    const { data, error } = await supabase
      .from('programs').select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[project-programs] 조회 실패:', error.message);
      toast.error('프로그램 목록을 불러오지 못했어요.');
    } else {
      setItems((data ?? []) as Program[]);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => { await reload(); if (cancelled) return; })();
    return () => { cancelled = true; };
  }, [reload, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted">
        <Loader2 size={16} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1E1B4B]">
          프로그램 <span className="text-slate-500 font-normal">({items.length}개)</span>
        </h2>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
          프로그램 추가
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState emoji="🎓" title="아직 등록된 프로그램이 없어요."
          description="이 프로젝트의 첫 프로그램을 만들어 보세요."
          action={
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              프로그램 추가
            </Button>
          } />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link to={`/programs/${p.id}`}
                className="block bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition p-4 h-full">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[p.status]}`}>{p.status}</span>
                  <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[p.type]}`}>{p.type}</span>
                </div>
                <h3 className="text-sm font-bold text-text line-clamp-2 mb-2">{p.name}</h3>
                <div className="space-y-1 text-xs text-slate-600">
                  {(p.start_date || p.end_date) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-slate-400 shrink-0" aria-hidden="true" />
                      <span>{formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}</span>
                    </div>
                  )}
                  {p.venue && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{p.venue}</span>
                    </div>
                  )}
                  {p.capacity != null && (
                    <div className="flex items-center gap-1.5">
                      <Users size={11} className="text-slate-400 shrink-0" aria-hidden="true" />
                      <span>정원 {p.capacity}명</span>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ProgramFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void reload()}
        defaultProjectId={projectId}
        defaultProjectName={projectName}
      />
    </div>
  );
}
