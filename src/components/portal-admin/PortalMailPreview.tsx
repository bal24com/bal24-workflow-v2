// 포털 안내 메일 본문 생성기 — 복사 후 카카오톡/이메일 직접 발송.
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN B-5.

import { useMemo, useState } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import type { PortalIntro } from '../../hooks/portal/usePortalAdmin';

interface Props {
  portalUrl: string;
  programTitle: string;
  schoolName?: string | null;
  teamLabel?: string | null;
  intro: PortalIntro;
}

function buildMailBody({ portalUrl, programTitle, schoolName, teamLabel, intro }: Props): string {
  const targetLine = teamLabel
    ? `${schoolName ?? '학교'} ${teamLabel} 담당 선생님께`
    : `${schoolName ?? '운영기관'} 담당 선생님께`;

  const lines: string[] = [];
  lines.push('안녕하세요.');
  lines.push(targetLine);
  lines.push('');
  lines.push(`[${programTitle}] 운영 포털을 안내드립니다.`);
  lines.push('');

  if (intro.operator || intro.purpose || intro.schedule) {
    lines.push('■ 사업 안내');
    if (intro.operator) lines.push(`  · 운영 주관: ${intro.operator}`);
    if (intro.purpose)  lines.push(`  · 사업 목적: ${intro.purpose}`);
    if (intro.schedule) lines.push(`  · 전체 일정: ${intro.schedule}`);
    lines.push('');
  }

  lines.push('■ 포털 접속 방법');
  lines.push('아래 URL로 접속하시면 동아리 현황·멘토 배정·일정 등을 확인하실 수 있습니다.');
  lines.push(`  👉 ${portalUrl}`);
  lines.push('');

  if (intro.pm_contact || intro.inquiry) {
    lines.push('■ 문의');
    if (intro.pm_contact) lines.push(`  · PM: ${intro.pm_contact}`);
    if (intro.inquiry)    lines.push(`  · 운영기관: ${intro.inquiry}`);
    lines.push('');
  }

  lines.push('감사합니다.');
  return lines.join('\n');
}

export default function PortalMailPreview(props: Props) {
  const body = useMemo(() => buildMailBody(props), [props]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[PortalMailPreview] 복사 실패:', raw);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((p) => !p)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900">
          <Mail size={14} aria-hidden="true" />
          📧 안내 메일 본문 {expanded ? '접기' : '미리보기'}
        </button>
        <button type="button" onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700">
          {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 본문 복사</>}
        </button>
      </div>
      {expanded && (
        <pre className="bg-white border border-amber-200 rounded p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
{body}
        </pre>
      )}
    </div>
  );
}
