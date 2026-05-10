// bal24 WorkFlow v2 — 라우팅 + 인증 가드
// 비로그인 → /login / 로그인 → Layout 안의 메뉴들 (14개)

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import ProgramsPage from './pages/programs/ProgramsPage';
import ProgramDetailPage from './pages/programs/ProgramDetailPage';
import ProgramEditPage from './pages/programs/edit/ProgramEditPage';
import ClientsPage from './pages/clients/ClientsPage';
import ExpertsPage from './pages/experts/ExpertsPage';
import ConsortiumPage from './pages/consortium/ConsortiumPage';
import ConsortiumDetailPage from './pages/consortium/ConsortiumDetailPage';
import IncomePage from './pages/income/IncomePage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import ReceiptsPage from './pages/receipts/ReceiptsPage';
import AttendancePage from './pages/attendance/AttendancePage';
import AttendanceDetailPage from './pages/attendance/AttendanceDetailPage';
import CheckInPage from './pages/attendance-checkin/CheckInPage';
import CertificatePage from './pages/certificates/CertificatePage';
import ActivityLogsPage from './pages/activity-logs/ActivityLogsPage';
import FormManagePage from './pages/forms/FormManagePage';
import PublicFormPage from './pages/public-form/PublicFormPage';
import ProjectReportPage from './pages/reports/ProjectReportPage';
import SettlementPage from './pages/settlements/SettlementPage';
import PortalManagePage from './pages/portal/PortalManagePage';
import PortalTemplatePage from './pages/portal/templates/PortalTemplatePage';
import ClientPortalPage from './pages/client-portal/ClientPortalPage';
import InstructorInvitePage from './pages/instructor-portal/InstructorInvitePage';
import CurriculumInvitePage from './pages/curriculum-invite/CurriculumInvitePage';
import SchedulePage from './pages/schedule/SchedulePage';
import MembersPage from './pages/members/MembersPage';
import SharesPage from './pages/shares/SharesPage';
import ReportsPage from './pages/reports/ReportsPage';
import AiPage from './pages/ai/AiPage';
import ApplicationPage from './pages/applications/ApplicationPage';
import RecruitPage from './pages/recruit/RecruitPage';
import ApplyPage from './pages/public-apply/ApplyPage';
import RecruitApplyPage from './pages/public-recruit/RecruitApplyPage';
import AttendCheckPage from './pages/public-attend/AttendCheckPage';
import LogWritePage from './pages/public-log/LogWritePage';
import CertViewPage from './pages/public-cert/CertViewPage';
import ClientSharePage from './pages/share-portal/ClientSharePage';
import StudentSharePage from './pages/share-portal/StudentSharePage';
import ExpertSharePage from './pages/share-portal/ExpertSharePage';
import MentoringMentorPage from './pages/mentoring/MentoringMentorPage';
import MentoringStudentPage from './pages/mentoring/MentoringStudentPage';
import MentoringPartnerView from './pages/mentoring/MentoringPartnerView';
import MyPage from './pages/mypage/MyPage';
import PartnerHomePage from './pages/partner/PartnerHomePage';
import MemberInvitePage from './pages/invite/MemberInvitePage';
import EvaluatePage from './pages/evaluate/EvaluatePage';
import { useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-sm text-muted">불러오는 중…</div>
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
      <Routes>
        {/* 인증 불필요 — 외부 공개 라우트 (token 기반) */}
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
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/programs/:id" element={<ProgramDetailPage />} />
          <Route path="/programs/:id/edit" element={<ProgramEditPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/experts" element={<ExpertsPage />} />
          <Route path="/shares" element={<SharesPage />} />

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

          {/* 통합 일지 (STEP 11-D) */}
          <Route path="/activity-logs" element={<ActivityLogsPage />} />

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

          {/* 기타 */}
          <Route path="/members" element={<MembersPage />} />
          <Route path="/team" element={<Navigate to="/members" replace />} />
          <Route path="/ai" element={<AiPage />} />

          {/* 구 경로 호환 */}
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
