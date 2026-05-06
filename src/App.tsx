// bal24 WorkFlow v2 — 라우팅 + 인증 가드
// 비로그인 → /login / 로그인 → Layout 안의 메뉴들 (14개)

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import ProgramsPage from './pages/programs/ProgramsPage';
import ClientsPage from './pages/clients/ClientsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { useAuth } from './contexts/AuthContext';

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
    <BrowserRouter>
      <Routes>
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
          <Route path="/schedule" element={<PlaceholderPage title="일정" description="캘린더와 일정 등록이 여기에 들어와요." />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/consortiums" element={<PlaceholderPage title="컨소시엄" description="컨소시엄 관리가 여기에 들어와요." />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/experts" element={<PlaceholderPage title="전문가" description="외부 전문가·강사풀 관리가 여기에 들어와요." />} />
          <Route path="/shares" element={<PlaceholderPage title="공유" description="외부 공유 링크 관리가 여기에 들어와요." />} />

          {/* 재무 */}
          <Route path="/income" element={<PlaceholderPage title="수입" description="수입 관리가 여기에 들어와요." />} />
          <Route path="/expense" element={<PlaceholderPage title="지출" description="지출 관리가 여기에 들어와요." />} />
          <Route path="/vouchers" element={<PlaceholderPage title="증빙" description="증빙·영수증 관리가 여기에 들어와요." />} />
          <Route path="/reports" element={<PlaceholderPage title="리포트" description="재무·실적 리포트가 여기에 들어와요." />} />

          {/* 기타 */}
          <Route path="/team" element={<PlaceholderPage title="팀원" description="내부 팀원 관리가 여기에 들어와요." />} />
          <Route path="/ai" element={<PlaceholderPage title="AI" description="AI 자동화 도구가 여기에 들어와요." />} />

          {/* 구 경로 호환 */}
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
