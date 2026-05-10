// bal24 v2 — STEP-EXPERT-CRUD-FULL 관리자 페이지 (admin 전용 진입)
// 현재 1탭(휴지통). 향후 시스템 설정·사용자 관리 등으로 확장.

import { Navigate } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import TrashTab from './TrashTab';

export default function AdminPage() {
  const { isAdmin, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> 권한 확인 중…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/home" replace />;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">⚙️</span>
        관리
      </h1>

      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
        <header className="flex items-center gap-2">
          <Trash2 size={16} className="text-rose-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[#1E1B4B]">휴지통</h2>
          <p className="text-[11px] text-slate-500">
            삭제된 고객사·전문가는 30일간 보관되며 자동으로 영구 삭제됩니다. 복원 또는 즉시 삭제 가능.
          </p>
        </header>
        <TrashTab />
      </section>
    </div>
  );
}
