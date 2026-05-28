// PM 포털 발급·관리 섹션 — 설정·공유 탭 내 배치.
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN B-2.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Copy, Check, Power, Building2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  listProgramPortals, listProjectPortals, toggleProgramPortal,
} from '../../hooks/portal/usePortalAdmin';
import PortalIssueModal from './PortalIssueModal';
import type { ProgramPortal, ProjectPortal } from '../../types/schoolPortal';

interface Props {
  programId: string;
  projectId: string | null;
}

type ProgramPortalRow = ProgramPortal & { school_name: string | null };

const SCOPE_TONE: Record<string, { label: string; tone: string }> = {
  school: { label: '학교 담당자', tone: 'bg-violet-100 text-violet-700' },
  team:   { label: '팀·학생',     tone: 'bg-teal-100 text-teal-700' },
};

function buildProgramUrl(token: string): string {
  return `${window.location.origin}/program-portal/${token}`;
}
function buildProjectUrl(token: string): string {
  return `${window.location.origin}/project-portal/${token}`;
}

export default function PortalIssueSection({ programId, projectId }: Props) {
  const toast = useToast();
  const [programPortals, setProgramPortals] = useState<ProgramPortalRow[]>([]);
  const [projectPortals, setProjectPortals] = useState<ProjectPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [pp, prj] = await Promise.all([
      listProgramPortals(programId),
      projectId ? listProjectPortals(projectId) : Promise.resolve([] as ProjectPortal[]),
    ]);
    setProgramPortals(pp);
    setProjectPortals(prj);
    setLoading(false);
  }, [programId, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const copyUrl = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[PortalIssueSection] 복사 실패:', raw);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const res = await toggleProgramPortal(id, !current);
    if (res.error) { toast.error(res.error); return; }
    toast.success(current ? '포털을 비활성화했어요.' : '포털을 활성화했어요.');
    void refresh();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-500" size={20} /></div>;
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
          <Building2 size={16} className="text-violet-500" aria-hidden="true" /> 포털 발급 관리 ({programPortals.length + projectPortals.length}개)
        </h2>
        <button type="button" onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-violet-600 text-white hover:bg-violet-700">
          <Plus size={12} /> 포털 발급
        </button>
      </div>

      {/* 프로그램 포털 (학교/팀) */}
      {programPortals.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-4">
          발급된 포털이 없어요. [포털 발급] 버튼으로 추가하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">유형</th>
                <th className="text-left px-3 py-2 font-semibold">동아리/팀명</th>
                <th className="text-left px-3 py-2 font-semibold">학교</th>
                <th className="text-left px-3 py-2 font-semibold">발급일</th>
                <th className="text-center px-3 py-2 font-semibold">상태</th>
                <th className="text-center px-3 py-2 font-semibold">URL</th>
                <th className="text-center px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {programPortals.map((p) => {
                const meta = SCOPE_TONE[p.access_scope] ?? SCOPE_TONE.school;
                const url = buildProgramUrl(p.portal_token);
                return (
                  <tr key={p.id} className="hover:bg-violet-50/30">
                    <td className="px-3 py-2">
                      <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.tone}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2 text-sm">{p.team_label ?? '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{p.school_name ?? '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">{p.created_at.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => void handleToggle(p.id, p.is_active)}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        <Power size={10} /> {p.is_active ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => void copyUrl(url, p.portal_token)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {copiedToken === p.portal_token ? <><Check size={11} /> 복사됨</> : <><Copy size={11} /> 복사</>}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <a href={url} target="_blank" rel="noreferrer"
                        className="text-[11px] font-bold text-violet-600 hover:underline">새 창</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 교육지원청 포털 */}
      {projectPortals.length > 0 && (
        <div className="border-t pt-3 mt-2 space-y-2">
          <h3 className="text-xs font-bold text-slate-600">🏛️ 교육지원청 포털 ({projectPortals.length})</h3>
          {projectPortals.map((p) => {
            const url = buildProjectUrl(p.portal_token);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 bg-indigo-50/40 border border-indigo-100 rounded-lg px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800">교육지원청 사업 전체 포털</span>
                  <span className="ml-2 text-xs text-slate-400">{p.created_at.slice(0, 10)}</span>
                </div>
                <button type="button" onClick={() => void copyUrl(url, p.portal_token)}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                  {copiedToken === p.portal_token ? <><Check size={11} /> 복사됨</> : <><Copy size={11} /> URL</>}
                </button>
                <a href={url} target="_blank" rel="noreferrer"
                  className="text-xs font-bold text-indigo-600 hover:underline">새 창</a>
              </div>
            );
          })}
        </div>
      )}

      <PortalIssueModal open={modalOpen} programId={programId} projectId={projectId}
        onClose={() => setModalOpen(false)} onIssued={() => void refresh()} />
    </section>
  );
}
