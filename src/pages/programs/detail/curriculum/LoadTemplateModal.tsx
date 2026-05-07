// bal24 v2 — 커리큘럼 템플릿 가져오기 모달 (Stage 3-C)
// 목록 + 검색 + 미리보기 + 가져오기 옵션 (덮어쓰기/뒤에 추가) + 삭제.

import { useEffect, useMemo, useState } from 'react';
import {
  Search, Loader2, Download, Trash2, ChevronRight, ChevronDown,
} from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import {
  fetchTemplates, fetchTemplateDetail, loadTemplateInto, deleteTemplate,
  type TemplateWithItems, type LoadMode,
} from './curriculumTemplateUtils';
import { trimTime } from './curriculumTabUtils';
import { inputClass } from '../../edit/cards/CardShell';
import { formatDateKo } from '../../../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  programId: string;
  /** 가져오기 성공 시 부모(CurriculumTab) refresh 트리거 */
  onLoaded: () => void;
}

export default function LoadTemplateModal({ open, onClose, programId, onLoaded }: Props) {
  const toast = useToast();
  const [list, setList] = useState<TemplateWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<TemplateWithItems | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mode, setMode] = useState<LoadMode>('append');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const next = await fetchTemplates();
      setList(next);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      setSearch('');
      setOpenId(null);
      setOpenDetail(null);
      setMode('append');
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = await fetchTemplates();
      if (cancelled) return;
      setList(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q),
    );
  }, [list, search]);

  async function togglePreview(t: TemplateWithItems) {
    if (openId === t.id) {
      setOpenId(null);
      setOpenDetail(null);
      return;
    }
    setOpenId(t.id);
    setDetailLoading(true);
    try {
      const detail = await fetchTemplateDetail(t.id);
      setOpenDetail(detail);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleLoad() {
    if (!openId) {
      toast.error('가져올 템플릿을 선택해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await loadTemplateInto(programId, openId, mode);
      if (!res.ok) {
        toast.error(res.error ?? '템플릿 가져오기에 실패했어요.');
        return;
      }
      toast.success(`${res.insertedCount ?? 0}개 차시를 가져왔어요.`);
      onLoaded();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(t: TemplateWithItems) {
    if (!window.confirm(`"${t.name}" 템플릿을 삭제할까요? 다른 프로그램의 차시는 영향 없어요.`)) return;
    const res = await deleteTemplate(t.id);
    if (!res.ok) {
      toast.error(res.error ?? '삭제에 실패했어요.');
      return;
    }
    toast.success('템플릿을 삭제했어요.');
    if (openId === t.id) {
      setOpenId(null);
      setOpenDetail(null);
    }
    void refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="템플릿에서 가져오기"
      description="저장된 커리큘럼 묶음을 현재 프로그램에 불러와요."
      size="brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button
            variant="primary"
            onClick={handleLoad}
            disabled={!openId || submitting}
            leftIcon={<Download size={14} />}
          >
            {submitting ? '가져오는 중…' : '가져오기'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="템플릿 이름·설명 검색"
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-xl border border-violet-100 bg-violet-50/30">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">
              {search ? '검색 결과가 없어요.' : '저장된 템플릿이 없어요. 먼저 [💾 템플릿으로 저장] 으로 만들어 보세요.'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((t) => {
                const isOpen = openId === t.id;
                return (
                  <li key={t.id} className="border-b border-violet-100/70 last:border-0">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void togglePreview(t)}
                        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-violet-600 hover:bg-violet-100"
                        aria-label={isOpen ? '미리보기 닫기' : '미리보기'}
                      >
                        {isOpen
                          ? <ChevronDown size={13} aria-hidden="true" />
                          : <ChevronRight size={13} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : t.id)}
                        className={`flex-1 min-w-0 text-left flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
                          isOpen ? 'bg-violet-100' : 'hover:bg-violet-100'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                          isOpen ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                        }`} aria-hidden="true" />
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="truncate text-xs font-semibold text-[#1E1B4B]">
                            {t.name}
                          </span>
                          {t.description && (
                            <span className="truncate text-[10px] text-slate-500">{t.description}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                          {t.item_count}차시
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                          {formatDateKo(t.created_at).replace(/^\d{4}년\s/, '')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        title="템플릿 삭제"
                        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="ml-9 mr-3 mb-2 rounded-md border border-violet-100 bg-white px-3 py-2">
                        {detailLoading ? (
                          <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                            불러오는 중…
                          </p>
                        ) : !openDetail || openDetail.items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">차시가 없어요.</p>
                        ) : (
                          <ul className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                            {openDetail.items.map((it) => (
                              <li key={it.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                                <span className="shrink-0 text-violet-600 font-bold tabular-nums">
                                  {it.session_no}.
                                </span>
                                <span className="flex-1 min-w-0 truncate">{it.title}</span>
                                {(it.start_time || it.end_time) && (
                                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                                    {trimTime(it.start_time)}
                                    {it.end_time && `~${trimTime(it.end_time)}`}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <fieldset className="rounded-xl border border-violet-100 bg-white px-3 py-2.5 flex flex-col gap-1.5">
          <legend className="px-1 text-[11px] font-bold text-slate-600">가져오기 방식</legend>
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="load-mode"
              value="append"
              checked={mode === 'append'}
              onChange={() => setMode('append')}
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold text-[#1E1B4B]">뒤에 추가</p>
              <p className="text-[10px] text-slate-500">
                기존 차시는 그대로 두고 템플릿 차시를 마지막 회차 뒤에 이어 붙여요.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="load-mode"
              value="replace"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold text-[#1E1B4B]">덮어쓰기 ⚠️</p>
              <p className="text-[10px] text-rose-500">
                기존 차시 + 매칭 인력 정보가 모두 삭제된 뒤 템플릿 차시로 교체돼요.
              </p>
            </div>
          </label>
        </fieldset>
      </div>
    </Modal>
  );
}
