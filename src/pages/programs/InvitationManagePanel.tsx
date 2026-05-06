// bal24 v2 — 프로그램 강사 초대 관리 슬라이드 패널

import { useCallback, useEffect, useState } from 'react';
import {
  X, Plus, Loader2, Copy, RefreshCw, FileIcon, ExternalLink,
} from 'lucide-react';
import { Badge, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  ROLE_VALUES, STATUS_LABEL, formatRole, getInvitationUrl,
  fileSizeLabel, extractStoragePath, INSTRUCTOR_FILES_BUCKET,
} from '../instructor-portal/invitationUtils';
import { formatDateKo } from '../../lib/utils';
import type {
  InstructorInvitation, InvitationFile, InvitationRole, InvitationStatus, StaffPool,
} from '../../types/database';

type Props = {
  open: boolean;
  programId: string;
  programName: string;
  onClose: () => void;
};

function statusBadgeVariant(s: InvitationStatus) {
  switch (s) {
    case '수락': return 'primary' as const;
    case '거절': return 'danger' as const;
    case '완료': return 'success' as const;
    default:      return 'default' as const;
  }
}

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  return '처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function InvitationManagePanel({ open, programId, programName, onClose }: Props) {
  const [invitations, setInvitations] = useState<InstructorInvitation[]>([]);
  const [experts, setExperts] = useState<Pick<StaffPool, 'id' | 'name' | 'phone' | 'email'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addExpanded, setAddExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 신규 초대 폼
  const [newExpertId, setNewExpertId] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<InvitationRole>('instructor');
  const [newNotes, setNewNotes] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingNew, setSavingNew] = useState(false);

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
      setInvitations((invR.data ?? []) as InstructorInvitation[]);
      setExperts(expR.data ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite-manage] 조회 실패:', raw);
      setErrorMsg('초대 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [open, programId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const onPickExpert = (id: string) => {
    setNewExpertId(id);
    if (!id) return;
    const e = experts.find((x) => x.id === id);
    if (e) {
      if (!newName.trim()) setNewName(e.name);
      if (!newPhone.trim() && e.phone) setNewPhone(e.phone);
      if (!newEmail.trim() && e.email) setNewEmail(e.email);
    }
  };

  const handleAddInvitation = async (replacementFor?: string) => {
    if (!newName.trim()) { setErrorMsg('강사 이름을 입력해 주세요.'); return; }
    setSavingNew(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from('instructor_invitations').insert({
        program_id: programId,
        expert_id: newExpertId || null,
        staff_pool_id: newExpertId || null,
        name: newName.trim(),
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        role: newRole,
        notes: newNotes.trim() || null,
        status: '대기',
        invited_at: new Date().toISOString(),
        replacement_for: replacementFor ?? null,
      });
      if (error) throw error;
      setNewExpertId(''); setNewName(''); setNewPhone(''); setNewEmail('');
      setNewRole('instructor'); setNewNotes('');
      setAddExpanded(false);
      await fetchData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite-manage] 추가 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSavingNew(false);
    }
  };

  const handleCopyLink = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(getInvitationUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite-manage] 복사 실패:', raw);
      setErrorMsg('링크 복사에 실패했어요.');
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
      // 새 초대 폼에 replacement_for 저장 (간단히 notes에 표시)
      setNewNotes(`(${inv.name} 강사 교체)`);
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
          {errorMsg && (
            <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
          )}

          {addExpanded ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h3 className="text-sm font-bold text-primary">새 강사 초대</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">전문가 풀에서 선택 (선택)</label>
                  <select value={newExpertId} onChange={(e) => onPickExpert(e.target.value)} disabled={savingNew}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <option value="">직접 입력</option>
                    {experts.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                  </select>
                </div>
                <Input label="이름" required value={newName} onChange={(e) => setNewName(e.target.value)} disabled={savingNew} />
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">역할</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as InvitationRole)} disabled={savingNew}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                    {ROLE_VALUES.map((r) => (<option key={r} value={r}>{formatRole(r)}</option>))}
                  </select>
                </div>
                <Input label="전화" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} disabled={savingNew} />
                <Input label="이메일" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} disabled={savingNew} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">메모 (강사에게 보일 메시지)</label>
                <textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} disabled={savingNew}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddExpanded(false)} disabled={savingNew}>취소</Button>
                <Button variant="primary" size="sm" loading={savingNew} onClick={() => void handleAddInvitation()}>초대 만들기</Button>
              </div>
            </div>
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
                        <Badge variant={statusBadgeVariant(inv.status)}>{STATUS_LABEL[inv.status]}</Badge>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{formatRole(inv.role)}</span>
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
