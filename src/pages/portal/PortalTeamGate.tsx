// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 수혜자 팀코드 입력 게이트.

import { useState } from 'react';
import { Loader2, Users2 } from 'lucide-react';
import { verifyTeamCode, type TeamInfo } from './portalAuth';

interface Props {
  portalId: string;
  portalTitle: string;
  onSuccess: (team: TeamInfo) => void;
}

export default function PortalTeamGate({ portalId, portalTitle, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('팀코드를 입력해 주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const team = await verifyTeamCode(portalId, trimmed);
      if (!team) {
        setError('등록되지 않은 팀코드예요.');
        return;
      }
      onSuccess(team);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[PortalTeamGate] 팀코드 검증 오류:', raw);
      setError('인증 처리 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-violet-100 shadow-card p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <Users2 size={22} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-[#1E1B4B]">팀 입장</h1>
          <p className="text-sm text-slate-500">{portalTitle}</p>
          <p className="text-xs text-slate-400">관리자로부터 받은 팀코드를 입력해 주세요.</p>
        </div>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          disabled={submitting}
          placeholder="예) TEAM01"
          className="w-full h-12 rounded-xl border border-slate-200 px-4 text-center text-base font-bold tracking-widest outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-50"
          aria-label="팀코드 입력"
        />

        {error && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !code.trim()}
          className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2">
          {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          입장하기
        </button>

        <p className="text-[10px] text-slate-400 text-center">
          팀코드는 대소문자 구분 없어요. 분실 시 관리자에게 문의해 주세요.
        </p>
      </div>
    </div>
  );
}
