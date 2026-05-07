// bal24 v2 — 외부 공개 폼 내부 관리 (목록 + 슬라이드 패널 신청자)

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Loader2, ClipboardList, Copy, X, Edit3, ExternalLink, Calendar, Users,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { copyToClipboard } from '../../lib/clipboard';
import type { FormType, Program, PublicForm } from '../../types/database';
import FormCreateModal from './FormCreateModal';
import FormApplicationsTab from './FormApplicationsTab';

const PUBLIC_BASE = 'https://bal24.kr';

export function getFormPublicUrl(token: string): string {
  return `${PUBLIC_BASE}/form/${token}`;
}

const FORM_TYPE_LABELS: Record<FormType, string> = {
  application: '신청서', survey: '설문', feedback: '피드백',
};

type FormRow = PublicForm & {
  applications: { id: string }[];
};

const SELECT_COLUMNS = '*, applications:form_applications(id)';

export default function FormManagePage() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState<string>('전체');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FormRow | null>(null);
  const [activeForm, setActiveForm] = useState<FormRow | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [fR, pR] = await Promise.all([
        supabase.from('public_forms').select(SELECT_COLUMNS).order('created_at', { ascending: false }),
        supabase.from('programs').select('id, name').order('created_at', { ascending: false }),
      ]);
      if (fR.error) throw fR.error;
      if (pR.error) console.error('[forms] programs 조회 실패:', pR.error.message);
      setForms((fR.data ?? []) as FormRow[]);
      setPrograms(pR.data ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[forms] 조회 실패:', raw);
      setErrorMsg('폼 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const visible = useMemo(() => {
    if (programFilter === '전체') return forms;
    return forms.filter((f) => f.program_id === programFilter);
  }, [forms, programFilter]);

  const handleCopy = async (token: string) => {
    const ok = await copyToClipboard(getFormPublicUrl(token));
    if (ok) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } else {
      setErrorMsg('링크 복사에 실패했어요. 직접 선택해서 복사해 주세요.');
    }
  };

  const handleEdit = (f: FormRow) => {
    setEditing(f);
    setCreateOpen(true);
  };

  const isOpen = (f: FormRow): boolean => {
    if (!f.is_active) return false;
    const now = Date.now();
    if (f.open_at && new Date(f.open_at).getTime() > now) return false;
    if (f.close_at && new Date(f.close_at).getTime() < now) return false;
    return true;
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500">프로그램 필터</label>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-w-[14rem]"
          >
            <option value="전체">전체 프로그램</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setCreateOpen(true); }}>
          폼 만들기
        </Button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <ClipboardList size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-muted mb-3">
            {programFilter !== '전체' ? '선택한 프로그램의 폼이 없어요.' : '아직 등록된 폼이 없어요.'}
          </p>
          <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => { setEditing(null); setCreateOpen(true); }}>
            첫 폼 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((f) => {
            const opened = isOpen(f);
            const reached = f.max_applicants != null && f.applications.length >= f.max_applicants;
            return (
              <Card key={f.id} className="hover:border-primary/30 hover:shadow-md transition h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setActiveForm(f)} className="flex-1 min-w-0 text-left">
                      <h3 className="text-sm font-bold text-text truncate hover:text-primary transition-colors">{f.title}</h3>
                      <div className="text-xs text-muted truncate mt-0.5">{FORM_TYPE_LABELS[f.form_type]}</div>
                    </button>
                    <Badge variant={opened && !reached ? 'success' : 'default'}>
                      {!f.is_active ? '비활성' : reached ? '마감' : opened ? '활성' : '대기'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar size={11} className="text-slate-400" />
                    {f.open_at ? formatDateKo(f.open_at) : '시작 미정'} ~ {f.close_at ? formatDateKo(f.close_at) : '마감 미정'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Users size={11} className="text-slate-400" />
                    {f.applications.length}{f.max_applicants != null ? `/${f.max_applicants}` : ''}명 신청
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onClick={() => void handleCopy(f.form_token)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <Copy size={12} />
                      {copiedToken === f.form_token ? '복사됨!' : 'URL 복사'}
                    </button>
                    <a href={getFormPublicUrl(f.form_token)} target="_blank" rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary">
                      <ExternalLink size={11} />열기
                    </a>
                    <button type="button" onClick={() => handleEdit(f)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary">
                      <Edit3 size={11} />수정
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 우측 슬라이드 패널: 신청자 목록 */}
      {activeForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setActiveForm(null)} aria-hidden="true" />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col"
            role="dialog" aria-modal="true" aria-label="신청자 목록">
            <header className="flex items-start justify-between gap-2 p-5 border-b border-slate-200">
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-lg font-bold text-text truncate">{activeForm.title}</h2>
                <p className="text-xs text-muted truncate">{FORM_TYPE_LABELS[activeForm.form_type]} · 신청자 {activeForm.applications.length}명</p>
              </div>
              <button type="button" onClick={() => setActiveForm(null)}
                aria-label="닫기"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50">
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <FormApplicationsTab form={activeForm} />
            </div>
          </aside>
        </>
      )}

      <FormCreateModal
        open={createOpen}
        programs={programs}
        defaultProgramId={programFilter !== '전체' ? programFilter : undefined}
        form={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}
