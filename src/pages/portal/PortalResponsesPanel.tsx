// bal24 v2 — 포털 항목별 회신 현황 슬라이드 패널

import { useEffect, useState } from 'react';
import { X, FileIcon, ExternalLink, Check, CircleDashed, Loader2 } from 'lucide-react';
import { Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ITEM_TYPE_LABELS, PORTAL_FILES_BUCKET } from './portalConstants';
import { formatDateKo } from '../../lib/utils';
import type { PortalItem, PortalResponse, ProjectPortal } from '../../types/database';

type ItemRow = PortalItem & { responses: PortalResponse[] };

type Props = {
  open: boolean;
  portal: ProjectPortal | null;
  onClose: () => void;
};

const SELECT_COLUMNS = '*, responses:portal_responses(*)';

export default function PortalResponsesPanel({ open, portal, onClose }: Props) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !portal) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    supabase.from('portal_items')
      .select(SELECT_COLUMNS)
      .eq('portal_id', portal.id)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[portal-responses] 조회 실패:', error.message);
          setErrorMsg('회신 현황을 불러오지 못했어요.');
        } else {
          setItems((data ?? []) as ItemRow[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, portal]);

  const handleOpenFile = async (url: string) => {
    setOpeningFile(url);
    setErrorMsg(null);
    try {
      const marker = `/${PORTAL_FILES_BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx < 0) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const path = url.slice(idx + marker.length).split('?')[0];
      const { data, error } = await supabase.storage.from(PORTAL_FILES_BUCKET).createSignedUrl(path, 60);
      if (error || !data) {
        setErrorMsg('파일 열기 권한이 없어요.');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningFile(null);
    }
  };

  if (!open || !portal) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col"
        role="dialog" aria-modal="true" aria-label="회신 현황">
        <header className="flex items-start justify-between gap-2 p-5 border-b border-slate-200">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-lg font-bold text-text truncate">{portal.title}</h2>
            <p className="text-xs text-muted truncate">
              항목 {items.length}개 · 완료 {items.filter((i) => i.completed).length}
            </p>
          </div>
          <button type="button" onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {errorMsg && (
            <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted">
              <Loader2 size={16} className="animate-spin mr-2" />
              불러오는 중…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">항목이 없어요.</p>
          ) : (
            items.map((it) => (
              <article key={it.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text truncate">{it.label}</div>
                    <div className="text-[10px] text-muted">
                      {ITEM_TYPE_LABELS[it.item_type]}
                      {it.required && ' · 필수'}
                    </div>
                  </div>
                  {it.completed ? (
                    <Badge variant="success"><Check size={10} className="mr-0.5" />완료</Badge>
                  ) : (
                    <Badge variant="default"><CircleDashed size={10} className="mr-0.5" />미완료</Badge>
                  )}
                </div>
                {it.description && <p className="text-xs text-muted">{it.description}</p>}
                {it.completed_at && (
                  <p className="text-[10px] text-muted">완료 시각 {formatDateKo(it.completed_at)}</p>
                )}

                {it.responses.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    {it.responses.map((r) => (
                      <div key={r.id} className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-muted">
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{r.response_type}</span>
                          <span>{formatDateKo(r.submitted_at)}</span>
                        </div>
                        {r.content && <p className="text-text whitespace-pre-wrap bg-slate-50/60 rounded p-2">{r.content}</p>}
                        {r.file_url && (
                          <button type="button" onClick={() => void handleOpenFile(r.file_url!)} disabled={openingFile === r.file_url}
                            className="inline-flex items-center gap-1 text-primary hover:underline">
                            <FileIcon size={11} />
                            {r.file_name ?? '파일'}
                            {openingFile === r.file_url ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
