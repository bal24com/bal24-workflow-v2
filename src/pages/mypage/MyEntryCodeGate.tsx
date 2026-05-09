// bal24 v2 — STEP-MYPAGE 입장코드 게이트
// MyPage 진입 시 사용자의 참여 프로그램 중 entry_code 가 있는 게 있으면 표시.
// 입력 코드가 그 중 하나와 일치하면 통과.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { Button, Input } from '../../components/ui';

interface Props {
  /** 후보 entry_code 목록 (NULL 제외) — 하나라도 일치하면 통과 */
  validCodes: string[];
  /** 사용자에게 보여줄 프로그램명 (대표 1개) */
  programName?: string;
  onSuccess: () => void;
}

export default function MyEntryCodeGate({ validCodes, programName, onSuccess }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!input.trim()) {
      setError('입장코드를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    const ok = validCodes.some((c) => c === input.trim());
    if (!ok) {
      setError('입장코드가 올바르지 않습니다.');
      setSubmitting(false);
      return;
    }
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-violet-100 p-6 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
            <Lock size={20} aria-hidden="true" />
          </div>
          <h1 className="text-base font-bold text-[#1E1B4B]">
            {programName ? `${programName} 입장코드를 입력해 주세요` : '입장코드를 입력해 주세요'}
          </h1>
          <p className="text-xs text-slate-500">담당자가 안내한 코드를 입력하면 마이페이지가 열려요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <Input
            type="password"
            label="입장코드"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={submitting}
            maxLength={20}
            placeholder="입장코드"
            autoFocus
          />
          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>
          )}
          <Button type="submit" variant="primary" className="!w-full" loading={submitting}>
            입장하기
          </Button>
        </form>
      </div>
    </div>
  );
}
