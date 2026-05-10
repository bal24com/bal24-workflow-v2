// bal24 WorkFlow v2 — 라우팅 + 인증 가드
// 비로그인 → /login / 로그인 → Layout 안의 메뉴들 (14개)
// STEP-BUNDLE-SPLIT — 공개 라우트 19종은 lazy import + Suspense 로 분리

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import ClientsPage from './pages/clients/ClientsPage';
import ExpertsPage from './pages/experts/ExpertsPage';
import ConsortiumPage from './pages/consortium/ConsortiumPage';
import ConsortiumDetailPage from './pages/consortium/ConsortiumDetailPage';
import IncomePage from './pages/income/IncomePage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import ReceiptsPage from './pages/receipts/ReceiptsPage';
import AttendancePage from './pages/attendance/AttendancePage';
import AttendanceDetailPage from './pages/attendance/AttendanceDetailPage';
import ActivityLogsPage from './pages/activity-logs/ActivityLogsPage';
import FormManagePage from './pages/forms/FormManagePage';
import PortalManagePage from './pages/portal/PortalManagePage';
import PortalTemplatePage from './pages/portal/templates/PortalTemplatePage';
import SchedulePage from './pages/schedule/SchedulePage';
import MembersPage from './pages/members/MembersPage';
import ReportsPage from './pages/reports/ReportsPage';
import AiPage from './pages/ai/AiPage';
import ApplicationPage from './pages/applications/ApplicationPage';
import RecruitPage from './pages/recruit/RecruitPage';
import MentoringPartnerView from './pages/mentoring/MentoringPartnerView';
import PartnerHomePage from './pages/partner/PartnerHomePage';
import MyReportPage from './pages/my-report/MyReportPage';
import { useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';

// ── PrivateRoute 안쪽이지만 vendor-docs(docx/jspdf/html2canvas/xlsx) 를 끌어오는
//    무거운 페이지들도 lazy 처리 (STEP-BUNDLE-SPLIT-2)
const ProgramDetailPage    = lazy(() => import('./pages/programs/ProgramDetailPage'));
const ProgramEditPage      = lazy(() => import('./pages/programs/edit/ProgramEditPage'));
const CertificatePage      = lazy(() => import('./pages/certificates/CertificatePage'));
const ProjectReportPage    = lazy(() => import('./pages/reports/ProjectReportPage'));
const SettlementPage       = lazy(() => import('./pages/settlements/SettlementPage'));

// ── 공개 라우트 (인증 불필요) — lazy import 로 메인 청크에서 분리 ──
const CheckInPage           = lazy(() => import('./pages/attendance-checkin/CheckInPage'));
const PublicFormPage        = lazy(() => import('./pages/public-form/PublicFormPage'));
const ClientPortalPage      = lazy(() => import('./pages/client-portal/ClientPortalPage'));
const InstructorInvitePage  = lazy(() => import('./pages/instructor-portal/InstructorInvitePage'));
const CurriculumInvitePage  = lazy(() => import('./pages/curriculum-invite/CurriculumInvitePage'));
const ApplyPage             = lazy(() => import('./pages/public-apply/ApplyPage'));
const RecruitApplyPage      = lazy(() => import('./pages/public-recruit/RecruitApplyPage'));
const AttendCheckPage       = lazy(() => import('./pages/public-attend/AttendCheckPage'));
const LogWritePage          = lazy(() => import('./pages/public-log/LogWritePage'));
const CertViewPage          = lazy(() => import('./pages/public-cert/CertViewPage'));
const ClientSharePage       = lazy(() => import('./pages/share-portal/ClientSharePage'));
const StudentSharePage      = lazy(() => import('./pages/share-portal/StudentSharePage'));
const ExpertSharePage       = lazy(() => import('./pages/share-portal/ExpertSharePage'));
const MentoringMentorPage   = lazy(() => import('./pages/mentoring/MentoringMentorPage'));
const MentoringStudentPage  = lazy(() => import('./pages/mentoring/MentoringStudentPage'));
const MyPage                = lazy(() => import('./pages/mypage/MyPage'));
const MemberInvitePage      = lazy(() => import('./pages/invite/MemberInvitePage'));
const EvaluatePage          = lazy(() => import('./pages/evaluate/EvaluatePage'));
const AuditPortalPage       = lazy(() => import('./pages/audit/AuditPortalPage'));
const JoinRequestPage       = lazy(() => import('./pages/join/JoinRequestPage'));

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-sm text-muted">불러오는 중…</div>
    </div>
  );
}

// 공개 라우트 lazy 로딩 중 표시 — 미니멀 스피너
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" aria-hidden="true" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <ToastContainer />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 인증 불필요 — 외부 공개 라우트 (token 기반, lazy) */}
            <Route path="/checkin/:token" element={<CheckInPage />} />
            <Route path="/form/:token" element={<PublicFormPage />} />
            <Route path="/portal/:token" element={<ClientPortalPage />} />
            <Route path="/invitation/:token" element={<InstructorInvitePage />} />
            <Route path="/curriculum-invite/:token" element={<CurriculumInvitePage />} />
            <Route path="/apply/:programId" element={<ApplyPage />} />
            <Route path="/recruit/:token" element={<RecruitApplyPage />} />
            <Route path="/attend/:token" element={<AttendCheckPage />} />
            <Route path="/log/:token" element={<LogWritePage />} />
            <Route path="/cert/:token" element={<CertViewPage />} />
            <Route path="/share/client/:token" element={<ClientSharePage />} />
            <Route path="/share/student/:token" element={<StudentSharePage />} />
            <Route path="/share/expert/:token" element={<ExpertSharePage />} />
            <Route path="/mentoring-mentor/:token" element={<MentoringMentorPage />} />
            <Route path="/mentoring-student/:token" element={<MentoringStudentPage />} />
            <Route path="/my/:token" element={<MyPage />} />
            <Route path="/invite/member/:token" element={<MemberInvitePage />} />
            <Route path="/evaluate/:token" element={<EvaluatePage />} />
            <Route path="/audit/:token" element={<AuditPortalPage />} />
            <Route path="/join" element={<JoinRequestPage />} />

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* 운영 */}
              <Route path="/home" element={<DashboardPage />} />
              <Route path="/partner-home" element={<PartnerHomePage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/report" element={<ProjectReportPage />} />
              <Route path="/consortium" element={<ConsortiumPage />} />
              <Route path="/consortium/:id" element={<ConsortiumDetailPage />} />
              <Route path="/consortiums" element={<Navigate to="/consortium" replace />} />
              {/* STEP-MENU-RESTRUCTURE — /programs 리스트는 /projects 로 통합 (북마크 호환) */}
              <Route path="/programs" element={<Navigate to="/projects" replace />} />
              <Route path="/programs/:id" element={<ProgramDetailPage />} />
              <Route path="/programs/:id/edit" element={<ProgramEditPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/experts" element={<ExpertsPage />} />
              {/* STEP-MENU-RESTRUCTURE — /shares 메뉴 제거 (북마크 호환 redirect) */}
              <Route path="/shares" element={<Navigate to="/home" replace />} />

              {/* 재무 */}
              <Route path="/income" element={<IncomePage />} />
              <Route path="/expense" element={<ExpensesPage />} />
              <Route path="/settlements" element={<SettlementPage />} />
              <Route path="/receipts" element={<ReceiptsPage />} />
              <Route path="/vouchers" element={<Navigate to="/receipts" replace />} />

              {/* 출석체크 (STEP 11-B) */}
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/attendance/:sessionId" element={<AttendanceDetailPage />} />

              {/* 수료증·강의확인서 (STEP 11-C) */}
              <Route path="/certificates" element={<CertificatePage />} />

              {/* 통합 일지 (STEP 11-D) — /logs alias (STEP-MENU-RESTRUCTURE) */}
              <Route path="/activity-logs" element={<ActivityLogsPage />} />
              <Route path="/logs" element={<ActivityLogsPage />} />

              {/* 외부 공개 폼 관리 (STEP 11-E) */}
              <Route path="/forms" element={<FormManagePage />} />

              {/* 교육생 신청·모집 공고 (STEP 11 옵션 B) */}
              <Route path="/applications" element={<ApplicationPage />} />
              <Route path="/recruit-manage" element={<RecruitPage />} />

              {/* 고객 문서 포털 (STEP 15) */}
              <Route path="/portals" element={<PortalManagePage />} />
              <Route path="/portal/templates" element={<PortalTemplatePage />} />
              <Route path="/reports" element={<ReportsPage />} />

              {/* 멘토링 — PARTNER 본인 배정 뷰 (STEP-MENTORING) */}
              <Route path="/mentoring" element={<MentoringPartnerView />} />

              {/* MEMBER 사업보고 (STEP-MEMBER-INVITE-REPORT placeholder) */}
              <Route path="/my-report" element={<MyReportPage />} />

              {/* 기타 */}
              <Route path="/members" element={<MembersPage />} />
              <Route path="/team" element={<Navigate to="/members" replace />} />
              <Route path="/ai" element={<AiPage />} />

              {/* 구 경로 호환 */}
              <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
