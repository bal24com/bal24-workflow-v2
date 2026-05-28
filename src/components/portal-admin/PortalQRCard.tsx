// 포털 QR 카드 — URL 복사 + QR 코드 출력.
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN B-4.

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, Download } from 'lucide-react';

interface Props {
  portalToken: string;
  scope: 'school' | 'team' | 'supervisor';
  teamLabel?: string | null;
  programTitle?: string;
  schoolName?: string | null;
}

function buildUrl(scope: Props['scope'], token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bal24.kr';
  if (scope === 'supervisor') return `${origin}/project-portal/${token}`;
  return `${origin}/program-portal/${token}`;
}

export default function PortalQRCard({ portalToken, scope, teamLabel, programTitle, schoolName }: Props) {
  const url = buildUrl(scope, portalToken);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[PortalQRCard] 복사 실패:', raw);
    }
  };

  const downloadQR = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `portal-qr-${teamLabel ?? scope}-${portalToken.slice(0, 8)}.png`;
    a.click();
  };

  const scopeLabel = scope === 'supervisor' ? '교육지원청' : scope === 'team' ? '팀·학생' : '학교 담당자';

  return (
    <div className="bg-white border border-violet-100 rounded-xl p-4 space-y-3">
      <div>
        <div className="text-xs font-bold text-violet-700 mb-1">📤 {scopeLabel} 포털</div>
        {teamLabel && <div className="text-sm font-bold text-slate-800">{teamLabel}</div>}
        {schoolName && <div className="text-xs text-slate-500">{schoolName}</div>}
        {programTitle && <div className="text-[11px] text-slate-400 mt-0.5">{programTitle}</div>}
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div ref={canvasRef} className="bg-white p-2 rounded border border-slate-200">
          <QRCodeCanvas value={url} size={128} includeMargin={false} />
        </div>
        <div className="flex-1 min-w-0 w-full space-y-2">
          <p className="text-xs break-all bg-slate-50 px-2 py-1.5 rounded text-slate-700">{url}</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => void copyUrl()}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold bg-violet-600 text-white hover:bg-violet-700">
              {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> URL 복사</>}
            </button>
            <button type="button" onClick={downloadQR}
              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">
              <Download size={12} /> QR 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
