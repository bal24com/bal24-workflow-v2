// bal24 v2 — 폼 신청자 목록 + 상태 변경 + CSV 다운로드

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, Loader2 } from 'lucide-react';
import { Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type {
  ApplicationStatus, FormApplication, PublicForm,
} from '../../types/database';

const STATUS_VALUES: ApplicationStatus[] = ['검토중', '승인', '대기', '취소'];

function statusBadgeVariant(s: ApplicationStatus) {
  switch (s) {
    case '승인':   return 'primary' as const;
    case '대기':   return 'secondary' as const;
    case '취소':   return 'danger' as const;
    default:        return 'default' as const;
  }
}

type Props = {
  form: PublicForm;
};

export default function FormApplicationsTab({ form }: Props) {
  const [apps, setApps] = useState<FormApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('form_applications')
        .select('*')
        .eq('form_id', form.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setApps((data ?? []) as FormApplication[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[forms-apps] 조회 실패:', raw);
      setErrorMsg('신청자 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [form.id]);

  useEffect(() => { void fetchApps(); }, [fetchApps]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => {
      const hay = [a.applicant_name, a.applicant_phone, a.applicant_email].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [apps, search]);

  const updateStatus = async (app: FormApplication, status: ApplicationStatus) => {
    setSavingId(app.id);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('form_applications')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', app.id);
      if (error) throw error;
      setApps((prev) => prev.map((p) => (p.id === app.id ? { ...p, status } : p)));
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[forms-apps] 상태 변경 실패:', raw);
      setErrorMsg('상태 변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSavingId(null);
    }
  };

  const startEditNote = (app: FormApplication) => {
    setEditingNoteId(app.id);
    setNoteDraft(app.review_note ?? '');
  };

  const saveNote = async (app: FormApplication) => {
    setSavingId(app.id);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('form_applications')
        .update({ review_note: noteDraft.trim() || null })
        .eq('id', app.id);
      if (error) throw error;
      setApps((prev) => prev.map((p) => (p.id === app.id ? { ...p, review_note: noteDraft.trim() || null } : p)));
      setEditingNoteId(null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[forms-apps] 메모 저장 실패:', raw);
      setErrorMsg('메모 저장에 실패했어요.');
    } finally {
      setSavingId(null);
    }
  };

  const downloadCsv = () => {
    const header = ['이름', '전화', '이메일', '상태', '신청일'];
    const rows = visible.map((a) => [
      a.applicant_name ?? '',
      a.applicant_phone ?? '',
      a.applicant_email ?? '',
      a.status,
      a.submitted_at,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    // Excel 호환: BOM 추가
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title}_신청자_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·전화 검색"
            className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={visible.length === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={12} />
          CSV 다운로드 ({visible.length})
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-muted">
          <Loader2 size={14} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted text-center py-8">
          {search.trim() ? '검색 결과가 없어요.' : '아직 신청자가 없어요.'}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-2 py-2 font-semibold">신청일</th>
                <th className="text-left px-2 py-2 font-semibold">이름</th>
                <th className="text-left px-2 py-2 font-semibold">전화</th>
                <th className="text-left px-2 py-2 font-semibold">이메일</th>
                <th className="text-center px-2 py-2 font-semibold">상태</th>
                <th className="text-left px-2 py-2 font-semibold">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-2 py-2 text-muted whitespace-nowrap">{formatDateKo(a.submitted_at)}</td>
                  <td className="px-2 py-2 font-semibold text-text">{a.applicant_name ?? '–'}</td>
                  <td className="px-2 py-2 text-muted">{a.applicant_phone ?? '–'}</td>
                  <td className="px-2 py-2 text-muted truncate max-w-[12rem]">{a.applicant_email ?? '–'}</td>
                  <td className="px-2 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <Badge variant={statusBadgeVariant(a.status)}>{a.status}</Badge>
                      <select
                        value={a.status}
                        onChange={(e) => void updateStatus(a, e.target.value as ApplicationStatus)}
                        disabled={savingId === a.id}
                        aria-label="상태 변경"
                        className="text-[10px] rounded border border-slate-200 bg-white px-1 py-0.5 outline-none focus:border-primary"
                      >
                        {STATUS_VALUES.map((s) => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {editingNoteId === a.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          autoFocus
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-primary"
                        />
                        <button type="button" onClick={() => void saveNote(a)} disabled={savingId === a.id}
                          className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">저장</button>
                        <button type="button" onClick={() => setEditingNoteId(null)}
                          className="text-xs text-muted hover:underline">취소</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startEditNote(a)}
                        className="text-left text-muted hover:text-primary truncate max-w-[16rem] block w-full">
                        {a.review_note || <span className="text-slate-400">메모 추가</span>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
