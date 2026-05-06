// bal24 WorkFlow v2 — 라우팅 + 인증 가드
// 비로그인 → /login / 로그인 → Layout 안의 메뉴들

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/dashboard/DashboardPage';
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
  if (session) return <Navigate to="/dashboard" replace />;
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/tasks"
            element={<PlaceholderPage title="업무관리" description="태스크 보드와 칸반 뷰가 여기에 들어와요." />}
          />
          <Route
            path="/schedule"
            element={<PlaceholderPage title="일정관리" description="캘린더와 일정 등록이 여기에 들어와요." />}
          />
          <Route
            path="/meetings"
            element={<PlaceholderPage title="미팅" description="회의록과 미팅 일정 관리가 여기에 들어와요." />}
          />
          <Route
            path="/clients"
            element={<PlaceholderPage title="거래처" description="거래처 목록과 상세 관리가 여기에 들어와요." />}
          />
          <Route
            path="/staff"
            element={<PlaceholderPage title="인력" description="강사·인력풀 관리가 여기에 들어와요." />}
          />
          <Route
            path="/billing"
            element={<PlaceholderPage title="정산" description="정산 현황과 입출금이 여기에 들어와요." />}
          />
          <Route
            path="/reports"
            element={<PlaceholderPage title="사업보고" description="실적 리포트와 결과보고서가 여기에 들어와요." />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
