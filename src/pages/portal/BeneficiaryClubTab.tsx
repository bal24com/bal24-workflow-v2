// 박경수님 2026-06-07 STEP-PORTAL-BENEFICIARY-CLUBS — 수혜기관용 동아리 통합 관리 탭.
// 학교(org_name)에 소속된 모든 동아리 목록 및 활동 현황 조회.

import { useEffect, useState } from 'react';
import { 
  Loader2, Users, CalendarDays, ExternalLink, Activity,
  ChevronRight, BookOpen, User, GraduationCap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import EmptyState from '../../components/EmptyState';

interface ProgramClub {
  id: string;
  club_name: string;
  school_name: string;
  teacher_name: string | null;
  mentor_name: string | null;
  student_count: number | null;
  club_type: string | null;
  club_token: string;
  program_id: string;
  programs: { name: string } | null;
}

interface Props {
  orgName: string;
}

export default function BeneficiaryClubTab({ orgName }: Props) {
  const [clubs, setClubs] = useState<ProgramClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('program_clubs')
          .select('*, programs:programs(name)')
          .eq('school_name', orgName)
          .is('deleted_at', null)
          .order('club_name');

        if (cancelled) return;
        if (error) throw error;
        
        // Supabase join 결과 처리
        const formatted = (data ?? []).map((c: any) => ({
          ...c,
          programs: Array.isArray(c.programs) ? c.programs[0] : c.programs
        }));
        
        setClubs(formatted as ProgramClub[]);
      } catch (err) {
        console.error('[BeneficiaryClubTab] fetch 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgName]);

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-violet-400" /></div>;
  }

  if (clubs.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-violet-100 p-12 shadow-sm text-center">
        <EmptyState 
          emoji="🤝" 
          title="소속된 동아리가 없어요." 
          description="관리자가 학교명을 정확히 등록했는지 확인이 필요해요." 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 px-2">
        <h2 className="text-lg font-black text-[#1E1B4B] flex items-center gap-2">
          <Activity size={20} className="text-violet-600" />
          우리 학교 동아리 ({clubs.length})
        </h2>
        <p className="text-xs text-slate-400 font-medium">학교 소속 동아리들의 활동 현황을 관리합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
    </div>
  );
}

function ClubCard({ club }: { club: ProgramClub }) {
  return (
    <div className="bg-white rounded-3xl border border-violet-50 p-6 shadow-sm hover:border-violet-200 transition-all group flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[9px] font-black uppercase tracking-tighter">
                {club.club_type || '일반 동아리'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">{club.programs?.name}</span>
            </div>
            <h3 className="text-lg font-black text-[#1E1B4B] group-hover:text-violet-600 transition-colors">
              {club.club_name}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-sm">
            <Users size={20} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <InfoRow Icon={User} label="지도교사" value={club.teacher_name || '미지정'} />
          <InfoRow Icon={GraduationCap} label="학생수" value={club.student_count ? `${club.student_count}명` : '-'} />
          <InfoRow Icon={BookOpen} label="담당 멘토" value={club.mentor_name || '미지정'} />
          <InfoRow Icon={CalendarDays} label="멘토링" value="일정 확인" />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50">
        <a 
          href={`/share/club/${club.club_token}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm group/btn"
        >
          상세 활동 및 일정 관리
          <ExternalLink size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}

function InfoRow({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
        <Icon size={12} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">{label}</p>
        <p className="text-xs font-bold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}
