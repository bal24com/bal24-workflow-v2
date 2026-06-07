// bal24 v2 — 공유 링크 카드 공용 컴포넌트
import { useState } from 'react';
import { Copy, Check, ExternalLink, MoreVertical, Power } from 'lucide-react';
import { Button } from '../ui';
import { formatDateKo } from '../../lib/utils';
import {
  buildLink,
  copyToClipboard,
  statusTone,
  CATEGORY_COLOR,
  CATEGORY_ICON,
  type SharedLink,
} from '../../pages/shares/sharesUtils';

interface Props {
  link: SharedLink;
  /** 활성/비활성 토글 기능 지원 여부 */
  onToggle?: (link: SharedLink) => Promise<void>;
  /** 카드 클릭 시 상세 동작 (선택) */
  onClick?: (link: SharedLink) => void;
  /** 추가 클래스 */
  className?: string;
}

export default function ShareLinkCard({ link, onToggle, onClick, className = '' }: Props) {
  const [isCopied, setIsCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const url = buildLink(link.path, link.token);
  const tone = statusTone(link.status);
  const Icon = CATEGORY_ICON[link.category];
  const color = CATEGORY_COLOR[link.category];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(url);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(null as any), 1500); // isCopied 타입 맞춤
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggle || toggling) return;
    setToggling(true);
    try {
      await onToggle(link);
    } finally {
      setToggling(false);
    }
  };

  return (
    <article
      onClick={() => onClick?.(link)}
      className={`group relative rounded-2xl border bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] transition-all hover:shadow-[0_8px_24px_rgba(124,58,237,0.1)] ${
        link.status === '비활성' || link.status === '닫힘'
          ? 'border-slate-100 bg-slate-50/50 opacity-80'
          : 'border-violet-100'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            <Icon size={20} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-[#1E1B4B] truncate" title={link.label}>
                {link.label}
              </h3>
              {link.status && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${tone.bg} ${tone.text} ring-black/5`}
                >
                  {link.status}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 text-xs text-slate-500">
              {link.subLabel && <p className="truncate text-slate-600 font-medium">{link.subLabel}</p>}
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="font-mono text-slate-400 truncate opacity-60">
                  {link.path}/{link.token.slice(0, 8)}…
                </span>
                <span className="text-slate-300 shrink-0">·</span>
                <span className="shrink-0">{formatDateKo(link.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {onToggle && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className="p-1 text-slate-400 hover:text-violet-600 transition-colors"
            title={link.status === '활성' ? '비활성화' : '활성화'}
          >
            <Power size={16} aria-hidden="true" className={toggling ? 'animate-pulse' : ''} />
          </button>
        )}
      </div>

      {link.stats && (
        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Clicks</span>
            <span className="text-sm font-bold text-[#1E1B4B]">{link.stats.clicks.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Responses</span>
            <span className="text-sm font-bold text-[#1E1B4B]">{link.stats.responses.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className={`flex-1 text-xs h-8 ${
            isCopied ? '!border-emerald-200 !bg-emerald-50 !text-emerald-700' : ''
          }`}
        >
          {isCopied ? (
            <>
              <Check size={14} className="mr-1.5" />
              복사됨
            </>
          ) : (
            <>
              <Copy size={14} className="mr-1.5" />
              링크 복사
            </>
          )}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          title="새 탭에서 열기"
        >
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
