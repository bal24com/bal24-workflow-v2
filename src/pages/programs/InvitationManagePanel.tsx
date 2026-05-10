// bal24 v2 — 프로그램 강사 초대 관리 슬라이드 패널

import { useCallback, useEffect, useState } from 'react';
import {
  X, Plus, Loader2, Copy, RefreshCw, FileIcon, ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  STATUS_LABEL, formatRole, getInvitationUrl,
  fileSizeLabel, extractStoragePath, INSTRUCTOR_FILES_BUCKET,
} from '../instructor-portal/invitationUtils';
import InvitationAddForm from './InvitationAddForm';
import { formatDateKo } from '../../lib/utils';
import { copyToClipboard } from '../../lib/clipboard';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../utils/statusStyles';
import type {
  InstructorInvitation, InvitationFile, StaffPool,
} from '../../types/database';

type Props = {
  open: boolean;
  programId: string;
  programName: string;
  onClose: () => void;
  /** STEP-INSTRUCTOR-INVITE-A — CurriculumTab에서 차시 지정 진입 시 폼 미리 채움 */
  defaultCurriculumId?: string | null;
  defaultSessionInfo?: string;
};


function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  return '처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function InvitationManagePanel({
  open, programId, programName, onClose, defaultCurriculumId, defaultSessionInfo,
}: Props) {
  const [invitations, setInvitations] = useState<InstructorInvitation[]>([]);
  const [experts, setExperts] = useState<Pick<StaffPool, 'id' | 'name' | 'phone' | 'email'>[]>([]);
  const [submittedMap, setSubmittedMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addExpanded, setAddExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 신호 파일 (단일 파일 다운로드)
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [invR, expR] = await Promise.all([
        supabase.from('instructor_invitations').select('*')
          .eq('program_id', programId)
          .order('invited_at', { ascending: false }),
        supabase.from('staff_pool').select('id, name, phone, email').order('name'),
      ]);
      if (invR.error) throw invR.error;
      if (expR.error) console.error('[invite-manage] staff 조회 실패:', expR.error.message);
      const invs = (invR.data ?? []) as InstructorInvitation[];
      setInvitations(invs);
      setExperts(expR.data ?? []);

      // STEP-INSTRUCTOR-INVITE-A — instructor_profiles.submitted 매핑 (배지용)
      if (invs.length > 0) {
        const ids = invs.map((i) => i.id);
        const { data: profs, error: profErr } = await supabase
          .from('instructor_profiles').select('invitation_id, submitted').in('invitation_id', ids);
        if (profErr) console.error('[invite-manage] profile 조회 실패:', profErr.message);
        const map = new Map<string, boolean>();
        for (const p of profs ?? []) map.set(p.invitation_id, Boolean(p.submitted));
        setSubmittedMap(map);
      } else {
        setSubmittedMap(new Map());
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite-manage] 조회 실패:', raw);
      setErrorMsg('초대 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [open, programId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // STEP-INSTRUCTOR-INVITE-A — 차시 지정 진입 시 폼 자동 펼침
  useEffect(() => {
    if (!open) return;
    if (defaultCurriculumId || defaultSessionInfo) setAddExpanded(true);
  }, [open, defaultCurriculumId, defaultSessionInfo]);

  // 통계 계산
  const stats = {
    total: invitations.length,
    pending: invitations.filter((i) => i.status === '대기').length,
    accepted: invitations.filter((i) => i.status === '수락').length,
    rejected: invitations.filter((i) => i.status === '거절').length,
  };


  const handleCopyLink = async (token: string, id: string) => {
    const ok = await copyToClipboard(getInvitationUrl(token));
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } else {
      setErrorMsg('링크 복사에 실패했어요. 직접 선택해서 복사해 주세요.');
    }
  };

  const handleReplace = async (inv: InstructorInvitation) => {
    if (!confirm(`"${inv.name}" 초대를 [교체됨]으로 표시하고 새 초대 폼을 열까요?`)) return;
    try {
      const { error } = await supabase
        .from('instructor_invitations')
        .update({ status: '거절', notes: `${inv.notes ?? ''}\n[교체됨]`.trim() })
        .eq('id', inv.id);
      if (error) throw error;
      setAddExpanded(true);
      await fetchData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite-manage] 교체 표시 실패:', raw);
      setErrorMsg(translateError(raw));
    }
  };

  const handleOpenFile = async (url: string) => {
    setOpeningUrl(url);
    try {
      const path = extractStoragePath(url);
      if (!path) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
      const { data, error } = await supabase.storage.from(INSTRUCTOR_FILES_BUCKET).createSignedUrl(path, 60);
      if (error || !data) {
        setErrorMsg('파일 열기 권한이 없어요.');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningUrl(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col"
        role="dialog" aria-modal="true" aria-label="강사 초대 관리">
        <header className="flex items-start justify-between gap-2 p-5 border-b border-slate-200">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-lg font-bold text-text truncate">{programName}</h2>
            <p className="text-xs text-muted">강사 초대 관리 ({invitations.length})</p>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP-INSTRUCTOR-INVITE-A — 통계 바 */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-600">총 <strong className="text-slate-800">{stats.total}</strong>명</span>
            <span className="text-amber-600">대기 <strong>{stats.pending}</strong></span>
            <span className="text-emerald-600">수락 <strong>{stats.accepted}</strong></span>
            <span className="text-red-600">거절 <strong>{stats.rejected}</strong></span>
          </div>

          {errorMsg && (
            <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
          )}

          {addExpanded ? (
            <InvitationAddForm
              programId={programId}
              experts={experts}
              defaultCurriculumId={defaultCurriculumId}
              defaultSessionInfo={defaultSessionInfo}
              onSubmitted={() => { setAddExpanded(false); void fetchData(); }}
              onCancel={() => setAddExpanded(false)}
            />
          ) : (
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAddExpanded(true)}>
              초대 추가
            </Button>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted">
              <Loader2 size={14} className="animate-spin mr-2" />
              불러오는 중…
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">아직 초대가 없어요. "초대 추가"로 시작해 주세요.</p>
          ) : (
            <ul className="space-y-3">
              {invitations.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text truncate">{inv.name}</span>
                        <span className={`${BADGE_BASE} ${INVITATION_STATUS_STYLE[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{formatRole(inv.role)}</span>
                        {submittedMap.get(inv.id) && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">프로필 완료</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        초대 {formatDateKo(inv.invited_at)}
                        {inv.responded_at && ` · 응답 ${formatDateKo(inv.responded_at)}`}
                      </div>
                    </div>
                  </div>

                  {inv.notes && (<p className="text-xs text-muted bg-slate-50 rounded p-2">{inv.notes}</p>)}
                  {inv.rejected_reason && (
                    <p className="text-xs text-danger bg-danger/5 rounded p-2">
                      <span className="font-semibold">거절 사유:</span> {inv.rejected_reason}
                    </p>
                  )}

                  {((inv.profile_files?.length ?? 0) > 0 || (inv.materials?.length ?? 0) > 0) && (
                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      {[
                        ...(inv.profile_files ?? []).map((f) => ({ label: '프로필', f })),
                        ...(inv.materials ?? []).map((f) => ({ label: '교안', f })),
                      ].map(({ label, f }: { label: string; f: InvitationFile }, idx) => (
                        <button key={idx} type="button" onClick={() => void handleOpenFile(f.url)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left">
                          <FileIcon size={12} className="text-primary shrink-0" />
                          <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-600">{label}</span>
                          <span className="text-xs font-semibold text-text truncate flex-1">{f.name}</span>
                          {f.size != null && <span className="text-[10px] text-muted">{fileSizeLabel(f.size)}</span>}
                          {openingUrl === f.url ? <Loader2 size={11} className="animate-spin text-primary" /> : <ExternalLink size={11} className="text-slate-400" />}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1 pt-2 border-t border-slate-100 text-xs">
                    {inv.portal_token && (
                      <button type="button" onClick={() => void handleCopyLink(inv.portal_token!, inv.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-primary hover:bg-primary/5">
                        <Copy size={11} />{copiedId === inv.id ? '복사됨!' : '초대 링크'}
                      </button>
                    )}
                    {(inv.status === '수락' || inv.status === '거절') && (
                      <button type="button" onClick={() => void handleReplace(inv)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-secondary hover:bg-secondary/5 ml-auto">
                        <RefreshCw size={11} />강사 교체
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
