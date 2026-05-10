// bal24 v2 — 강사 초대 신규 발송 폼 (InvitationManagePanel 분리)

import { useEffect, useState } from 'react';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ROLE_VALUES, formatRole } from '../instructor-portal/invitationUtils';
import { searchInstructorPool, type InstructorPoolEntry } from '../../lib/instructorProfileUtils';
import type { InvitationRole, StaffPool } from '../../types/database';

interface Props {
  programId: string;
  experts: Pick<StaffPool, 'id' | 'name' | 'phone' | 'email'>[];
  defaultCurriculumId?: string | null;
  defaultSessionInfo?: string;
  onSubmitted: () => void;
  onCancel: () => void;
}

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  return '처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function InvitationAddForm({
  programId, experts, defaultCurriculumId, defaultSessionInfo, onSubmitted, onCancel,
}: Props) {
  const [expertId, setExpertId] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<InvitationRole>('instructor');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [curriculumId, setCurriculumId] = useState<string>(defaultCurriculumId ?? '');
  const [sessionInfo, setSessionInfo] = useState<string>(defaultSessionInfo ?? '');
  const [inviteMessage, setInviteMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [poolQuery, setPoolQuery] = useState('');
  const [poolResults, setPoolResults] = useState<InstructorPoolEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (defaultCurriculumId) setCurriculumId(defaultCurriculumId);
    if (defaultSessionInfo) setSessionInfo(defaultSessionInfo);
  }, [defaultCurriculumId, defaultSessionInfo]);

  const onPickExpert = (id: string) => {
    setExpertId(id);
    if (!id) return;
    const e = experts.find((x) => x.id === id);
    if (e) {
      if (!name.trim()) setName(e.name);
      if (!phone.trim() && e.phone) setPhone(e.phone);
      if (!email.trim() && e.email) setEmail(e.email);
    }
  };

  const runPoolSearch = async (q: string) => {
    setPoolQuery(q);
    if (!q.trim()) { setPoolResults([]); return; }
    setPoolResults(await searchInstructorPool(q));
  };

  const onPickPool = (entry: InstructorPoolEntry) => {
    setProfileId(entry.id);
    if (!name.trim()) setName(entry.name);
    if (!phone.trim() && entry.phone) setPhone(entry.phone);
    if (!email.trim() && entry.email) setEmail(entry.email);
    setPoolResults([]);
    setPoolQuery('');
  };

  async function handleSubmit() {
    if (!name.trim()) { setErrorMsg('강사 이름을 입력해 주세요.'); return; }
    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from('instructor_invitations').insert({
        program_id: programId,
        expert_id: expertId || null,
        staff_pool_id: expertId || null,
        profile_id: profileId,
        curriculum_id: curriculumId || null,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        role,
        notes: notes.trim() || null,
        invite_message: inviteMessage.trim() || null,
        session_info: sessionInfo.trim() || null,
        status: '대기',
        invited_at: new Date().toISOString(),
      });
      if (error) throw error;
      onSubmitted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite-add] 추가 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <h3 className="text-sm font-bold text-primary">새 강사 초대</h3>

      {/* 인력풀 검색 (profiles) */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">인력풀 검색 (선택)</label>
        <input type="text" value={poolQuery}
          onChange={(e) => void runPoolSearch(e.target.value)} disabled={saving}
          placeholder="이름·이메일로 임직원·기존 강사 검색…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        {poolResults.length > 0 && (
          <ul className="rounded-lg border border-slate-200 bg-white max-h-40 overflow-y-auto">
            {poolResults.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onPickPool(p)}
                  className="block w-full text-left text-xs px-3 py-2 hover:bg-violet-50">
                  <span className="font-semibold text-slate-700">{p.name}</span>
                  {p.email && <span className="text-slate-400 ml-2">({p.email})</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {profileId && <p className="text-[11px] text-emerald-600">✓ 인력풀 강사 선택됨</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-semibold text-slate-700">전문가 풀에서 선택 (선택)</label>
          <select value={expertId} onChange={(e) => onPickExpert(e.target.value)} disabled={saving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="">직접 입력</option>
            {experts.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </select>
        </div>
        <Input label="이름" required value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">역할</label>
          <select value={role} onChange={(e) => setRole(e.target.value as InvitationRole)} disabled={saving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            {ROLE_VALUES.map((r) => (<option key={r} value={r}>{formatRole(r)}</option>))}
          </select>
        </div>
        <Input label="전화" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
        <Input label="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
      </div>

      <Input label="차시 정보 (선택)" value={sessionInfo} onChange={(e) => setSessionInfo(e.target.value)}
        disabled={saving} placeholder="예) 2차시 — AI 창업 전략" />

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">초청 메시지 (선택)</label>
        <textarea rows={3} value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} disabled={saving}
          placeholder="강사에게 보낼 개인화 메시지"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">메모 (내부 기록용)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>취소</Button>
        <Button variant="primary" size="sm" loading={saving} onClick={() => void handleSubmit()}>초대 만들기</Button>
      </div>
    </div>
  );
}
