// bal24 WorkFlow v2 — 라우팅 + 인증 가드
// 비로그인 → /login / 로그인 → Layout 안의 메뉴들 (14개)
// STEP-BUNDLE-SPLIT-3 — 첫 진입 속도 개선 (박경수님 보고).
//   eager: LoginPage, Layout, DashboardPage(/home 첫 진입) — 즉시 필요
//   lazy : 나머지 모든 인증 후 페이지 + 공개 라우트
//          → entry bundle 80~90KB → 30KB 수준으로 감소 기대.

import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/dashboard/DashboardPage';
import { useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
// 박경수님 + SkyClaw 2026-05-26 — 흰 화면 방지: chunk 재시도 + ErrorBoundary
import { lazyWithRetry as lazy } from './lib/lazyWithRetry';
import ErrorBoundary from './components/ErrorBoundary';

// ── 인증 후 페이지 — 모두 lazy (DashboardPage 외) ──
const ProjectsPage          = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetailPage     = lazy(() => import('./pages/projects/ProjectDetailPage'));
const ClientsPage           = lazy(() => import('./pages/clients/ClientsPage'));
const ExpertsPage           = lazy(() => import('./pages/experts/ExpertsPage'));
const ConsortiumPage        = lazy(() => import('./pages/consortium/ConsortiumPage'));
const ConsortiumDetailPage  = lazy(() => import('./pages/consortium/ConsortiumDetailPage'));
const IncomePage            = lazy(() => import('./pages/income/IncomePage'));
const ExpensesPage          = lazy(() => import('./pages/expenses/ExpensesPage'));
const ReceiptsPage          = lazy(() => import('./pages/receipts/ReceiptsPage'));
const ContractsPage         = lazy(() => import('./pages/contracts/ContractsPage'));
const PayrollPage           = lazy(() => import('./pages/payroll/PayrollPage'));
// 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28) — 직원 급여 관리 + 지출결의서
const PayrollMgmtPage       = lazy(() => import('./pages/payroll-mgmt/PayrollMgmtPage'));
// 박경수님 + SkyClaw STEP-PAYROLL-MYPAGE (2026-05-28) — 본인 급여명세서
const MyPayrollPage         = lazy(() => import('./pages/my-payroll/MyPayrollPage'));
const AccountingReviewPage  = lazy(() => import('./pages/accounting-portal/AccountingReviewPage'));
const AttendancePage        = lazy(() => import('./pages/attendance/AttendancePage'));
const AttendanceDetailPage  = lazy(() => import('./pages/attendance/AttendanceDetailPage'));
const ActivityLogsPage      = lazy(() => import('./pages/activity-logs/ActivityLogsPage'));
const FormManagePage        = lazy(() => import('./pages/forms/FormManagePage'));
const PortalManagePage      = lazy(() => import('./pages/portal/PortalManagePage'));
const PortalTemplatePage    = lazy(() => import('./pages/portal/templates/PortalTemplatePage'));
const SchedulePage          = lazy(() => import('./pages/schedule/SchedulePage'));
const MembersPage           = lazy(() => import('./pages/members/MembersPage'));
const AdminPage             = lazy(() => import('./pages/admin/AdminPage'));
const ReportsPage           = lazy(() => import('./pages/reports/ReportsPage'));
const AiPage                = lazy(() => import('./pages/ai/AiPage'));
const ApplicationPage       = lazy(() => import('./pages/applications/ApplicationPage'));
const RecruitPage           = lazy(() => import('./pages/recruit/RecruitPage'));
const MentoringPartnerView  = lazy(() => import('./pages/mentoring/MentoringPartnerView'));
const PartnerHomePage       = lazy(() => import('./pages/partner/PartnerHomePage'));
const MyReportPage          = lazy(() => import('./pages/my-report/MyReportPage'));
const AccountingReviewPortal = lazy(() => import('./pages/public/AccountingReviewPortal'));

// ── PrivateRoute 안쪽이지만 vendor-docs(docx/jspdf/html2canvas/xlsx) 를 끌어오는
//    무거운 페이지들도 lazy 처리 (STEP-BUNDLE-SPLIT-2)
const ProgramsPage         = lazy(() => import('./pages/programs/ProgramsPage'));
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
const ParticipantPortalPage = lazy(() => import('./pages/public-participant/ParticipantPortalPage'));
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
const MentorPortalPage      = lazy(() => import('./pages/mentor-portal/MentorPortalPage'));
// STEP-STAFF-PORTAL-P2 — 강사 통합 포털 (멘토+강의+일지+일정+자료)
const StaffPortalPage       = lazy(() => import('./pages/staff-portal/StaffPortalPage'));
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
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 인증 불필요 — 외부 공개 라우트 (token 기반, lazy) */}
            <Route path="/checkin/:token" element={<CheckInPage />} />
            <Route path="/form/:token" element={<PublicFormPage />} />
            <Route path="/portal/:token" element={<ClientPortalPage />} />
            {/* STEP-ACCOUNTING-ALL P4 — 회계사무소 외부 검토 포털 */}
            <Route path="/accounting-review/:token" element={<AccountingReviewPortal />} />
            <Route path="/invitation/:token" element={<InstructorInvitePage />} />
            <Route path="/participant/:token" element={<ParticipantPortalPage />} />
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
            {/* STEP-MENTOR-PORTAL-FULL — 미등록 멘토 초대 토큰 기반 외부 포털 */}
            <Route path="/mentor-invite/:token" element={<MentorPortalPage />} />
            {/* STEP-STAFF-PORTAL-P2 — 강사 통합 포털 (영구 staff_portal_token, 비로그인 공개) */}
            <Route path="/staff-portal/:token" element={<StaffPortalPage />} />
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
              {/* STEP-PROGRAM-BUNDLE — /programs 메뉴 복원 (직접 라우팅) */}
              <Route path="/programs" element={<ProgramsPage />} />
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
              {/* STEP-ACCOUNTING-ALL P2 — 수입/계약 신규 페이지 */}
              <Route path="/contracts" element={<ContractsPage />} />
              {/* STEP-ACCOUNTING-ALL P3 — 외주/급여 신규 페이지 */}
              <Route path="/payroll" element={<PayrollPage />} />
              {/* 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM — 직원 급여 + 지출결의서 */}
              <Route path="/payroll-mgmt" element={<PayrollMgmtPage />} />
              {/* 박경수님 + SkyClaw STEP-PAYROLL-MYPAGE — 본인 급여명세서 */}
              <Route path="/my-payroll" element={<MyPayrollPage />} />
              {/* STEP-ACCOUNTING-ALL P4 — 회계 검토 (PM 측) */}
              <Route path="/accounting-reviews" element={<AccountingReviewPage />} />

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
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/ai" element={<AiPage />} />

              {/* 구 경로 호환 */}
              <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ToastProvider>
  );
}
