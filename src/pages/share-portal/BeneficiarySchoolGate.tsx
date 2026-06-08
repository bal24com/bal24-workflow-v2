// 수혜기관(학교) 선택 게이트 — 학교 선택 후 소속 동아리 관리 진입.
// /share/beneficiary/:token 페이지에서 beneficiary 역할에만 렌더.

import { useEffect, useState } from 'react';
import { Loader2, School, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import BeneficiaryClubTab from '../portal/BeneficiaryClubTab';

interface Props {
  programId: string;
  /** 박경수님 2026-06-08 — URL ?org= 로 지정된 학교 (지정 시 선택 게이트 건너뜀·잠금) */
  preselectedSchool?: string;
}

export default function BeneficiarySchoolGate({ programId, preselectedSchool }: Props) {
  const [schools, setSchools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(preselectedSchool ?? null);
  const locked = Boolean(preselectedSchool);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('program_clubs')
          .select('school_name')
          .eq('program_id', programId);
        if (cancelled) return;
        if (error) throw error;
        const unique = [
          ...new Set(
            ((data ?? []) as Array<{ school_name: string | null }>)
              .map((r) => r.school_name ?? '')
              .filter(Boolean),
          ),
        ].sort();
        setSchools(unique);
        // 학교 1곳뿐이거나 URL 로 학교가 지정된 경우 자동 선택
        if (preselectedSchool) setSelectedSchool(preselectedSchool);
        else if (unique.length === 1) setSelectedSchool(unique[0]);
      } catch (err) {
        console.error('[BeneficiarySchoolGate] 학교 목록 조회 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [programId]);

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="animate-spin text-violet-400" size={20} />
      </div>
    );
  }

  if (schools.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* 학교 선택 헤더 */}
      <div className="flex items-center gap-2">
        <School size={16} className="text-cyan-600" />
        <h2 className="text-sm font-bold text-[#1E1B4B]">학교별 동아리 관리</h2>
      </div>

      {/* 학교 선택 버튼 목록 */}
      {!selectedSchool ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schools.map((school) => (
            <button
              key={school}
              type="button"
              onClick={() => setSelectedSchool(school)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm hover:border-cyan-300 hover:bg-cyan-50/50 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
                  <School size={16} />
                </div>
                <span className="text-sm font-bold text-[#1E1B4B]">{school}</span>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-cyan-600 transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 선택된 학교 + 변경 버튼 (학교 2개 이상 & URL 고정 아닐 때만) */}
          {schools.length > 1 && !locked && (
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <School size={14} className="text-cyan-600" />
                <span className="text-sm font-bold text-[#1E1B4B]">{selectedSchool}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchool(null)}
                className="text-xs text-slate-400 hover:text-cyan-600 font-semibold transition-colors"
              >
                학교 변경
              </button>
            </div>
          )}
          <BeneficiaryClubTab orgName={selectedSchool} programId={programId} />
        </div>
      )}
    </div>
  );
}
