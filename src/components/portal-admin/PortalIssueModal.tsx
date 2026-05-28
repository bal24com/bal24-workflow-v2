// 포털 발급 모달 — 동아리(학교담당자)/팀·학생/교육지원청 유형 선택.
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN B-3.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, X, ChevronDown } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  issueProgramPortal, issueProjectPortal,
  listSchoolClients, createSchoolClient,
  getPortalIntro, type PortalIntro,
} from '../../hooks/portal/usePortalAdmin';
import PortalQRCard from './PortalQRCard';
import PortalMailPreview from './PortalMailPreview';

type IssueScope = 'school' | 'team' | 'supervisor';

interface Props {
  open: boolean;
  programId: string;
  projectId: string | null;
  onClose: () => void;
  onIssued: () => void;
}

interface ClientOpt { id: string; name: string }

export default function PortalIssueModal({ open, programId, projectId, onClose, onIssued }: Props) {
  const toast = useToast();
  const [scope, setScope] = useState<IssueScope>('school');
  const [teamLabel, setTeamLabel] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [showNewSchool, setShowNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [intro, setIntro] = useState<PortalIntro>({});
  const [programTitle, setProgramTitle] = useState('');

  const reset = useCallback(() => {
    setScope('school');
    setTeamLabel('');
    setClientId('');
    setShowNewSchool(false);
    setNewSchoolName('');
    setIssuedToken(null);
  }, []);

  useEffect(() => {
    if (!open) { reset(); return; }
    let cancelled = false;
    void (async () => {
      const [list, introData] = await Promise.all([
        listSchoolClients(),
        getPortalIntro(programId),
      ]);
      if (cancelled) return;
      setClients(list);
      setIntro(introData.intro);
      setProgramTitle(introData.programTitle);
    })();
    return () => { cancelled = true; };
  }, [open, programId, reset]);

  if (!open) return null;

  const handleCreateSchool = async () => {
    if (!newSchoolName.trim()) return;
    const res = await createSchoolClient(newSchoolName);
    if (res.error || !res.id) {
      toast.error(res.error ?? '학교 등록 실패');
      return;
    }
    setClients((prev) => [{ id: res.id!, name: newSchoolName.trim() }, ...prev]);
    setClientId(res.id);
    setNewSchoolName('');
    setShowNewSchool(false);
    toast.success('학교를 등록했어요.');
  };

  const handleIssue = async () => {
    setIssuing(true);
    if (scope === 'supervisor') {
      if (!projectId) {
        toast.error('연결된 프로젝트가 없어요. 교육지원청 포털을 발급할 수 없어요.');
        setIssuing(false);
        return;
      }
      const res = await issueProjectPortal({ projectId, title: programTitle || '교육지원청 포털' });
      setIssuing(false);
      if (res.error || !res.portalToken) {
        toast.error(res.error ?? '발급 실패');
        return;
      }
      setIssuedToken(res.portalToken);
      onIssued();
      return;
    }
    // school / team
    if (scope === 'team' && !teamLabel.trim()) {
      toast.error('동아리/팀명을 입력해 주세요.');
      setIssuing(false);
      return;
    }
    const res = await issueProgramPortal({
      programId, scope, clientId: clientId || null,
      teamLabel: scope === 'team' ? teamLabel : null,
    });
    setIssuing(false);
    if (res.error || !res.portalToken) {
      toast.error(res.error ?? '발급 실패');
      return;
    }
    setIssuedToken(res.portalToken);
    onIssued();
  };

  const portalUrl = issuedToken
    ? (scope === 'supervisor'
        ? `${window.location.origin}/project-portal/${issuedToken}`
        : `${window.location.origin}/program-portal/${issuedToken}`)
    : '';
  const selectedSchool = clients.find((c) => c.id === clientId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !issuing) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <header className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800">
            {issuedToken ? '✅ 포털 발급 완료' : '📤 포털 발급'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          {!issuedToken ? (
            <>
              {/* 유형 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">포털 유형</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: 'school' as const, label: '동아리\n(학교 담당자)' },
                    { v: 'team' as const, label: '팀·학생' },
                    { v: 'supervisor' as const, label: '교육지원청' },
                  ]).map((opt) => (
                    <label key={opt.v} className={`cursor-pointer border-2 rounded-lg px-2 py-2 text-xs font-bold text-center whitespace-pre-line transition ${
                      scope === opt.v ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'
                    }`}>
                      <input type="radio" name="scope" value={opt.v} checked={scope === opt.v}
                        onChange={() => setScope(opt.v)} className="sr-only" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {scope !== 'supervisor' && (
                <>
                  {/* 동아리/팀명 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      동아리/팀명 {scope === 'team' && <span className="text-rose-500">*</span>}
                    </label>
                    <input value={teamLabel} onChange={(e) => setTeamLabel(e.target.value)}
                      placeholder="예) 꿈틀꿈틀 해양 창업가"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                  </div>

                  {/* 연결 학교 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">연결 학교</label>
                    <div className="flex gap-1.5">
                      <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm">
                        <option value="">선택 없음</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowNewSchool((p) => !p)}
                        className="px-2 rounded-lg border border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50">
                        <Plus size={12} className="inline" /> 신규
                      </button>
                    </div>
                    {showNewSchool && (
                      <div className="mt-1.5 flex gap-1.5 bg-slate-50 rounded-lg p-2">
                        <input value={newSchoolName} onChange={(e) => setNewSchoolName(e.target.value)}
                          placeholder="새 학교명 (예: 경호초등학교)"
                          className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:border-violet-500" />
                        <button type="button" onClick={() => void handleCreateSchool()}
                          className="text-xs font-bold px-2 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700">
                          등록
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {scope === 'supervisor' && (
                <p className="text-xs bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-indigo-700">
                  사업 전체 현황·강사·설문을 한 화면에서 보는 교육지원청 포털을 발급합니다.
                  {!projectId && <span className="block mt-1 text-rose-600 font-bold">⚠ 프로그램에 연결된 프로젝트가 없어요.</span>}
                </p>
              )}
            </>
          ) : (
            <>
              <PortalQRCard
                portalToken={issuedToken} scope={scope}
                teamLabel={scope === 'supervisor' ? null : (teamLabel || null)}
                programTitle={programTitle}
                schoolName={selectedSchool?.name ?? null}
              />
              <PortalMailPreview
                portalUrl={portalUrl}
                programTitle={programTitle}
                schoolName={selectedSchool?.name ?? null}
                teamLabel={scope === 'supervisor' ? null : (teamLabel || null)}
                intro={intro}
              />
            </>
          )}
        </div>

        <footer className="px-5 py-3 border-t flex items-center justify-end gap-1.5">
          {issuedToken ? (
            <button type="button" onClick={onClose}
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded text-xs font-bold bg-violet-600 text-white hover:bg-violet-700">
              닫기
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={issuing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">
                취소
              </button>
              <button type="button" onClick={() => void handleIssue()} disabled={issuing}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                {issuing ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />} 발급하기
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
