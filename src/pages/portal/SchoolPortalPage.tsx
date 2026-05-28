// 학교 담당자 포털 진입점 — program_portals.portal_token 기반 접근.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL.
// scope='school' → 탭 UI / scope='team' → TeamPortalPage 위임.

import { useState, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Building2, Users, ClipboardList, CalendarDays, FolderOpen } from 'lucide-react';
import { useSchoolPortal } from '../../hooks/portal/useSchoolPortal';
import SchoolOverviewTab from './school/SchoolOverviewTab';
import SchoolParticipantsTab from './school/SchoolParticipantsTab';
import SchoolSurveyTab from './school/SchoolSurveyTab';

const TeamPortalPage = lazy(() => import('./team/TeamPortalPage'));

type TabKey = 'overview' | 'participants' | 'survey' | 'schedule' | 'files';

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Building2 }> = [
  { key: 'overview',     label: '개요',         Icon: Building2 },
  { key: 'participants', label: '교육생·팀',     Icon: Users },
  { key: 'survey',       label: '설문',         Icon: ClipboardList },
  { key: 'schedule',     label: '일정·출석',    Icon: CalendarDays },
  { key: 'files',        label: '자료 다운로드', Icon: FolderOpen },
];

export default function SchoolPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { loading, error, context } = useSchoolPortal(token);
  const [tab, setTab] = useState<TabKey>('overview');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-violet-500" size={28} aria-hidden="true" />
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-base font-bold text-rose-600">{error ?? '유효하지 않은 링크예요.'}</p>
          <p className="text-xs text-slate-500">담당자에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  // 팀 포털은 별도 페이지 렌더
  if (context.portal.access_scope === 'team') {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-violet-500" size={28} /></div>}>
        <TeamPortalPage context={context} />
      </Suspense>
    );
  }

  // scope=school → 탭 UI
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="bg-gradient-to-r from-violet-600 to-violet-800 text-white px-6 py-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-xs font-semibold text-violet-200 mb-1">학교 담당자 포털</div>
          <h1 className="text-2xl font-extrabold leading-snug">{context.programTitle}</h1>
          <div className="mt-1.5 text-sm text-violet-100">
            {context.schoolName && <span>🏫 {context.schoolName}</span>}
            {context.programStartDate && (
              <span className="ml-2">📅 {context.programStartDate} ~ {context.programEndDate ?? ''}</span>
            )}
          </div>
        </div>
      </header>

      {/* 탭 네비 */}
      <nav role="tablist" aria-label="학교 포털 탭"
        className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                  active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}>
                <Icon size={14} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 탭 컨텐츠 */}
      <main className="max-w-[1100px] mx-auto px-4 py-5">
        {tab === 'overview'     && <SchoolOverviewTab context={context} />}
        {tab === 'participants' && <SchoolParticipantsTab context={context} />}
        {tab === 'survey'       && <SchoolSurveyTab context={context} />}
        {tab === 'schedule' && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 text-sm">
            일정·출석 정보는 곧 제공돼요.
          </div>
        )}
        {tab === 'files' && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 text-sm">
            자료 다운로드는 곧 제공돼요.
          </div>
        )}
      </main>

      <footer className="bg-slate-800 text-slate-300 text-xs text-center py-5 leading-loose mt-8">
        <p className="font-bold">{context.programTitle}</p>
        <p>운영기관: (주)밸런스닷 · 문의: ks@bal24.com</p>
      </footer>
    </div>
  );
}
