// bal24 v2 — 외부공유 대상별 탭 (Stage 3-B-1)
// 단일 audience 영역 — 링크 + QR + 노출 항목 체크박스 + 토큰 재발급.

import { useState } from 'react';
import {
  Copy, ExternalLink, QrCode, RefreshCw, ShieldCheck, Loader2,
} from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import type {
  ShareAudience, ShareItem, ShareStage, ShareVisibility,
} from '../../../../types/database';
import {
  ITEMS_BY_AUDIENCE, SHARE_AUDIENCE_LABEL, SHARE_ITEM_LABEL,
  SHARE_STAGE_LABEL, STAGE_ITEMS,
} from './visibilityCatalog';
import { buildShareUrl } from './shareUtils';
import QrPreviewModal from './QrPreviewModal';

interface Props {
  audience: ShareAudience;
  token: string;
  visibility: ShareVisibility;
  currentStage: ShareStage;
  onToggleItem: (item: ShareItem, next: boolean) => Promise<void>;
  onRegenerateToken: () => Promise<void>;
}

const STAGE_GROUPS: ShareStage[] = ['pre', 'ready', 'progress', 'result'];

export default function AudienceTab({
  audience, token, visibility, currentStage, onToggleItem, onRegenerateToken,
}: Props) {
  const toast = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState<ShareItem | null>(null);
  const [regen, setRegen] = useState(false);

  const url = buildShareUrl(audience, token);
  const audienceLabel = SHARE_AUDIENCE_LABEL[audience];
  const allItems = ITEMS_BY_AUDIENCE[audience];

  async function handleCopy() {
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${audienceLabel} 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  async function handleToggle(item: ShareItem, next: boolean) {
    setBusy(item);
    try {
      await onToggleItem(item, next);
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('이 토큰을 새로 발급할까요? 기존 링크는 더 이상 동작하지 않아요.')) return;
    setRegen(true);
    try {
      await onRegenerateToken();
      toast.success('토큰을 새로 발급했어요. 새 링크를 다시 공유하세요.');
    } finally {
      setRegen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 공유 링크 + 액션 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[#1E1B4B]">공유 링크</h3>
        </header>
        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
          <span className="flex-1 min-w-0 truncate text-xs text-slate-700 tabular-nums">{url}</span>
          <button
            type="button"
            onClick={handleCopy}
            title="링크 복사"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
          >
            <Copy size={13} aria-hidden="true" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="새 탭 열기"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
          >
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            title="QR 코드 보기"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
          >
            <QrCode size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void handleRegenerate()}
            disabled={regen}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            {regen
              ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
              : <RefreshCw size={11} aria-hidden="true" />}
            토큰 재발급
          </button>
        </div>
      </section>

      {/* 노출 항목 체크박스 — 단계별 그룹 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">노출 항목 ({allItems.length})</h3>
          <p className="text-[11px] text-slate-500">체크 시 외부 페이지에 표시 — 단계별 자동 적용</p>
        </header>

        {allItems.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            이 대상은 설정할 항목이 없어요.
          </p>
        ) : (
          STAGE_GROUPS.map((stage) => {
            const stageItems = STAGE_ITEMS[audience][stage];
            if (stageItems.length === 0) return null;
            const isCurrentStage = stage === currentStage;
            return (
              <div key={stage} className="flex flex-col gap-1.5">
                <p className={`text-[11px] font-bold ${
                  isCurrentStage ? 'text-violet-700' : 'text-slate-500'
                }`}>
                  {SHARE_STAGE_LABEL[stage]}
                  {isCurrentStage && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-violet-500 align-middle" aria-hidden="true" />
                  )}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {stageItems.map((item) => {
                    const checked = visibility[audience]?.[item] !== false;
                    const disabled = busy === item;
                    return (
                      <li key={item}>
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                            checked
                              ? 'border-violet-200 bg-violet-50/40 hover:bg-violet-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          } ${disabled ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => void handleToggle(item, e.target.checked)}
                            className="w-4 h-4 rounded border-violet-200 text-violet-600 focus:ring-violet-300 cursor-pointer"
                          />
                          <span className={`flex-1 text-xs font-semibold ${checked ? 'text-[#1E1B4B]' : 'text-slate-400'}`}>
                            {SHARE_ITEM_LABEL[item]}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <QrPreviewModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        audienceLabel={audienceLabel}
      />
    </div>
  );
}
