// bal24 v2 — 팀원 상세 슬라이드 패널 (STEP 18)
// 우측 슬라이드오버 + 담당 프로젝트 목록

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Mail, Phone, Building2, Calendar, Pencil, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { Profile, ProjectStatus } from '../../types/database';
import { getRoleBadge, normalizeRole } from './MembersPage';

interface ProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
}

interface Props {
  memberId: string;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (member: Profile) => void;
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function MemberDetailPanel({ memberId, isAdmin, onClose, onEdit }: Props) {
  const [member, setMember] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [m, p] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', memberId).maybeSingle(),
        supabase
          .from('projects')
          .select('id, name, status')
          .eq('pm_id', memberId)
          .neq('status', '종료')
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (m.error) console.error('[members] 팀원 상세 조회 실패:', m.error.message);
      if (p.error) console.error('[members] 담당 프로젝트 조회 실패:', p.error.message);
      setMember((m.data as Profile | null) ?? null);
      setProjects((p.data as ProjectRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="팀원 상세"
      >
        <header className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-[#1E1B4B]">팀원 상세</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-700 rounded-lg p-1 transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
            </div>
          ) : !member ? (
            <p className="text-sm text-slate-500 text-center py-12">팀원 정보를 찾을 수 없어요.</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={`${member.name} 프로필 사진`}
                    className="w-20 h-20 rounded-full object-cover border border-violet-100"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-3xl font-bold">
                    {initial(member.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold text-[#1E1B4B]">{member.name}</div>
                  <div className="text-sm text-slate-500 truncate">{member.position ?? '직책 미등록'}</div>
                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const tone = getRoleBadge(member.role);
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                          {normalizeRole(member.role) || '미정'}
                        </span>
                      );
                    })()}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        member.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {member.is_active ? '재직중' : '퇴직'}
                    </span>
                  </div>
                </div>
              </div>

              <section className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
                <DetailRow icon={<Mail size={16} aria-hidden="true" />} label="이메일">
                  <a href={`mailto:${member.email}`} className="text-violet-700 hover:underline">
                    {member.email}
                  </a>
                </DetailRow>
                {member.phone && (
                  <DetailRow icon={<Phone size={16} aria-hidden="true" />} label="연락처">
                    <a href={`tel:${member.phone}`} className="text-violet-700 hover:underline">
                      {member.phone}
                    </a>
                  </DetailRow>
                )}
                {member.department && (
                  <DetailRow icon={<Building2 size={16} aria-hidden="true" />} label="부서">
                    {member.department}
                  </DetailRow>
                )}
                {member.joined_at && (
                  <DetailRow icon={<Calendar size={16} aria-hidden="true" />} label="입사일">
                    {formatDateKo(member.joined_at)}
                  </DetailRow>
                )}
              </section>

              {member.slogan && (
                <p className="text-sm italic text-slate-600 border-l-2 border-violet-200 pl-3">
                  {member.slogan}
                </p>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-[#1E1B4B]">담당 프로젝트</h3>
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">담당 프로젝트 없음</p>
                ) : (
                  <ul className="space-y-1.5">
                    {projects.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/projects/${p.id}`}
                          className="block rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-slate-700 hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
                        >
                          <span className="font-semibold">{p.name}</span>
                          <span className="ml-2 text-xs text-slate-500">· {p.status}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        {!loading && member && isAdmin && (
          <footer className="p-5 border-t border-slate-100">
            <Button variant="primary" onClick={() => onEdit(member)} className="!w-full">
              <Pencil size={16} className="mr-1.5" aria-hidden="true" />
              수정
            </Button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-violet-500">{icon}</span>
      <span className="text-slate-500 w-16 shrink-0">{label}</span>
      <span className="text-slate-700 truncate">{children}</span>
    </div>
  );
}
