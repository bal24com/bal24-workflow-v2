// bal24 v2 — 전문가 목록 — 리스트 행 컴포넌트 (V-1 분리, 박경수님 2026-05-26)

import { Pencil, Trash2, Link2, Activity, UserStar } from 'lucide-react';
import type { StaffPool } from '../../types/database';
import ExpertRecentPrograms from './ExpertRecentPrograms';
import type { ExpertProgramRef } from './expertProgramsFetch';

interface Props {
  s: StaffPool;
  onEdit: () => void;
  onDelete: () => void;
  onCopyPortal: () => void;
  onShowActivity: () => void;
  onResetPin: () => void;
  recentPrograms?: ExpertProgramRef[];
}

export default function ExpertListRow({
  s, onEdit, onDelete, onCopyPortal, onShowActivity, onResetPin, recentPrograms,
}: Props) {
  return (
    <li className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition relative">
      {s.profile_image_url ? (
        <img src={s.profile_image_url} alt={`${s.name} 프로필`} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
      ) : (
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
          <UserStar size={18} />
        </span>
      )}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-text truncate flex items-center gap-1.5">
            {s.name}
            {s.staff_type && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
                {s.staff_type}
              </span>
            )}
          </div>
          <div className="text-xs text-muted truncate">
            {[s.organization, s.position].filter(Boolean).join(' · ') || '소속·직책 미지정'}
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted">
          {s.specialty?.length ? (
            <div className="flex flex-wrap gap-1">
              {s.specialty.map((t) => (
                <span key={t} className="bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">{t}</span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400">분야 미지정</span>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted">
          {/* 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — 최근 참여 프로그램 chip (리스트형) */}
          <ExpertRecentPrograms programs={recentPrograms} variant="list" />
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button type="button" onClick={onEdit} aria-label="수정"
          className="p-1.5 rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-600">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={onShowActivity} aria-label="활동 이력" title="활동 이력"
          className="p-1.5 rounded-md text-slate-400 hover:bg-cyan-50 hover:text-cyan-600">
          <Activity size={12} />
        </button>
        <button type="button" onClick={onResetPin} aria-label="PIN 초기화" title="PIN 을 전화번호 끝 6자리로 초기화"
          className="p-1.5 rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-600 text-sm leading-none">
          🔑
        </button>
        <button type="button" onClick={onCopyPortal} aria-label="강사 포털 링크 복사" title="강사 포털 링크 복사"
          className="p-1.5 rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-600">
          <Link2 size={12} />
        </button>
        <button type="button" onClick={onDelete} aria-label="삭제"
          className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}
