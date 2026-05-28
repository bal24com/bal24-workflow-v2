// 교육지원청 포털 — project_portals.portal_token 기반 전체 현황.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART E-1.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Building2, GraduationCap, ClipboardList } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import SupervisorSchoolsTab from './SupervisorSchoolsTab';
import SupervisorSurveysTab from './SupervisorSurveysTab';
import type { ProjectPortal, SupervisorPortalContext } from '../../../types/schoolPortal';

type TabKey = 'schools' | 'instructors' | 'surveys';

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Building2 }> = [
  { key: 'schools',     label: '학교별 현황',  Icon: Building2 },
  { key: 'instructors', label: '강사 투입',    Icon: GraduationCap },
  { key: 'surveys',     label: '전체 설문',    Icon: ClipboardList },
];

interface PortalRow extends ProjectPortal {
  projects: { id: string; name: string } | { id: string; name: string }[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function SupervisorPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [context, setContext] = useState<SupervisorPortalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('schools');

  const fetchContext = useCallback(async () => {
    if (!token) {
      setError('잘못된 링크예요.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('project_portals')
      .select(`
        id, project_id, portal_token, access_scope, is_active, created_at,
        projects!project_portals_project_id_fkey(id, name)
      `)
      .eq('portal_token', token)
      .eq('is_active', true)
      .maybeSingle<PortalRow>();

    if (dbErr) {
      console.error('[SupervisorPortalPage] 조회 실패:', dbErr.message);
      setError('포털 정보를 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    if (!data) {
      setError('유효하지 않은 링크예요.');
      setLoading(false);
      return;
    }
    const proj = pickOne(data.projects);
    if (!proj) {
      setError('연결된 프로젝트가 없어요.');
      setLoading(false);
      return;
    }
    setContext({
      portal: {
        id: data.id, project_id: data.project_id, portal_token: data.portal_token,
        access_scope: data.access_scope, is_active: data.is_active, created_at: data.created_at,
      },
      projectId: proj.id,
      projectTitle: proj.name,
    });
    setLoading(false);
  }, [token]);

  useEffect(() => { void fetchContext(); }, [fetchContext]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-violet-500" size={28} /></div>;
  }
  if (error || !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-base font-bold text-rose-600">{error ?? '유효하지 않은 링크예요.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-indigo-700 to-violet-800 text-white px-6 py-7">
        <div className="max-w-[1200px] mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-white/15 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            🏛️ 교육지원청 포털
          </div>
          <h1 className="text-2xl font-extrabold leading-snug">{context.projectTitle}</h1>
          <p className="mt-1 text-sm text-indigo-100">사업 전체 현황·강사 투입·설문 결과를 한 화면에서 확인하세요.</p>
        </div>
      </header>

      <nav role="tablist" className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                  active ? 'text-indigo-700 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}>
                <Icon size={14} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto px-4 py-5">
        {tab === 'schools'     && <SupervisorSchoolsTab projectId={context.projectId} />}
        {tab === 'instructors' && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 text-sm">
            강사 투입 현황은 곧 제공돼요.
          </div>
        )}
        {tab === 'surveys'     && <SupervisorSurveysTab projectId={context.projectId} />}
      </main>
    </div>
  );
}
