// bal24 v2 — 컨소시엄 탭2: 프로그램 (consortium_id 격리)

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, MapPin, Calendar, Users, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui';
import { BADGE_BASE, PROGRAM_STATUS_STYLE, PROGRAM_TYPE_STYLE } from '../../../utils/statusStyles';
import EmptyState from '../../../components/EmptyState';
import { formatConDate } from '../consortiumUtils';
import { MEMBER_TYPE_LABEL, MEMBER_TYPE_STYLE, type ConsortiumMember, type MemberType } from '../consortiumTypes';
import type { Program, ProgramStatus, ProgramType } from '../../../types/database';

interface Props {
  consortiumId: string;
  members: ConsortiumMember[];
  onAdd?: () => void;
}

export default function ConProgramsTab({ consortiumId, members, onAdd }: Props) {
  const toast = useToast();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      // STEP-TRASH-FILTER-AUDIT — 휴지통 프로그램 제외 (헤더 카운트와 동일하게)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('consortium_id', consortiumId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPrograms((data as ProgramRow[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-programs] 조회 실패:', raw);
      toast.error('프로그램 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchPrograms();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchPrograms]);

  const handleAdd = () => {
    if (onAdd) {
      onAdd();
    } else {
      toast.info('프로그램 페이지에서 등록 시 컨소시엄을 선택해 주세요.');
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <EmptyState
        emoji="🎓"
        title="아직 등록된 프로그램이 없어요."
        description="컨소시엄에서 운영할 프로그램을 추가해 주세요."
        action={
          <div className="flex items-center gap-2">
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={handleAdd}>
              + 프로그램 추가
            </Button>
            <Link to="/programs" className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1">
              프로그램 페이지
              <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">총 {programs.length}건 — 컨소시엄 소속 프로그램만 표시</p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={handleAdd}>
          + 프로그램 추가
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {programs.map((p) => {
          const memberLeads = members.filter((m) => m.member_type === 'lead');
          return (
            <article
              key={p.id}
              className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2 hover:border-violet-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[p.type as ProgramType] ?? PROGRAM_TYPE_STYLE.기타}`}>
                      {p.type}
                    </span>
                    <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[p.status as ProgramStatus] ?? PROGRAM_STATUS_STYLE.준비}`}>
                      {p.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#1E1B4B] truncate">{p.name}</h3>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-500">
                {(p.start_date || p.end_date) && (
                  <div className="inline-flex items-center gap-1">
                    <Calendar size={11} aria-hidden="true" />
                    {formatConDate(p.start_date ?? null)} ~ {formatConDate(p.end_date ?? null)}
                  </div>
                )}
                {p.venue && (
                  <div className="inline-flex items-center gap-1">
                    <MapPin size={11} aria-hidden="true" />
                    <span className="truncate">{p.venue}</span>
                  </div>
                )}
                {p.capacity != null && (
                  <div className="inline-flex items-center gap-1">
                    <Users size={11} aria-hidden="true" />
                    정원 {p.capacity}명
                  </div>
                )}
              </div>

              {memberLeads.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400">담당:</span>
                  {memberLeads.map((m) => (
                    <span
                      key={m.id}
                      className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded ${MEMBER_TYPE_STYLE[m.member_type as MemberType]}`}
                    >
                      {MEMBER_TYPE_LABEL[m.member_type as MemberType]} {m.clients?.name ?? '미지정'}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
     );
        })}
      </div>
    </div>
  );
}
