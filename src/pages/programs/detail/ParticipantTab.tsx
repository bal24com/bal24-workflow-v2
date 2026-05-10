// bal24 v2 — STEP-PARTICIPANT-PORTAL PM용 참여자 관리 탭

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Copy, Trash2, CheckCircle2, FileUp, Search, FileText,
} from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import ParticipantDocImportModal from './ParticipantDocImportModal';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import {
  PARTICIPANT_ROLE_LABEL, PARTICIPANT_ROLE_BADGE, PARTICIPANT_ROLE_VALUES,
  copyParticipantLink, parseParticipantCSV, type ParsedParticipantRow,
} from '../../../lib/participantUtils';
import type { ParticipantRole, ProgramParticipant } from '../../../types/database';

interface Props {
  programId: string;
  programName: string;
  canEdit: boolean;
}

interface AddForm {
  name: string;
  role: ParticipantRole;
  email: string;
  phone: string;
  expiresAt: string;
  memo: string;
}

const EMPTY_FORM: AddForm = { name: '', role: 'participant', email: '', phone: '', expiresAt: '', memo: '' };

export default function ParticipantTab({ programId, canEdit }: Props) {
  const toast = useToast();
  const [list, setList] = useState<ProgramParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<ParsedParticipantRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_participants').select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[participant-tab] 조회 실패:', error.message);
      toast.error('참여자 목록을 불러오지 못했어요.');
    } else {
      setList((data ?? []) as ProgramParticipant[]);
    }
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [reload, programId]);

  const stats = {
    total: list.length,
    participant: list.filter((p) => p.role === 'participant').length,
    mentor: list.filter((p) => p.role === 'mentor').length,
    client: list.filter((p) => p.role === 'client').length,
    completed: list.filter((p) => p.status === 'completed').length,
  };

  const visible = search.trim()
    ? list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : list;

  async function handleAdd() {
    if (!form.name.trim()) { toast.error('이름을 입력해 주세요.'); return; }
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('program_participants').insert({
          program_id: programId,
          name: form.name.trim(),
          role: form.role,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          token_expires_at: form.expiresAt || null,
          memo: form.memo.trim() || null,
        }).select('access_token').single();
      if (error) throw error;
      const created = data as { access_token: string };
      const ok = await copyParticipantLink(created.access_token);
      setForm(EMPTY_FORM);
      setAddOpen(false);
      await reload();
      toast.success(ok ? '참여자가 등록됐어요. 링크가 복사됐어요.' : '참여자가 등록됐어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[participant-tab] 등록 실패:', raw);
      toast.error('등록 중 오류가 발생했어요.');
    } finally {
      setAdding(false);
    }
  }

  async function handleCopy(p: ProgramParticipant) {
    const ok = await copyParticipantLink(p.access_token);
    if (ok) toast.success('링크가 복사됐어요.');
    else toast.error('링크 복사에 실패했어요.');
  }

  async function handleComplete(p: ProgramParticipant) {
    const { error } = await supabase
      .from('program_participants')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) {
      console.error('[participant-tab] 수료 처리 실패:', error.message);
      toast.error('수료 처리에 실패했어요.');
      return;
    }
    await reload();
    toast.success('수료 처리됐어요.');
  }

  async function handleDelete(p: ProgramParticipant) {
    if (!window.confirm(`"${p.name}" 참여자를 삭제할까요?`)) return;
    const { error } = await supabase.from('program_participants').delete().eq('id', p.id);
    if (error) {
      console.error('[participant-tab] 삭제 실패:', error.message);
      toast.error('삭제에 실패했어요.');
      return;
    }
    await reload();
    toast.success('삭제됐어요.');
  }

  function runCsvParse() {
    const rows = parseParticipantCSV(csvText);
    if (rows.length === 0) {
      toast.error('CSV에서 참여자 정보를 찾지 못했어요.');
      setBulkPreview([]);
      return;
    }
    setBulkPreview(rows);
  }

  async function handleBulkInsert() {
    if (bulkPreview.length === 0) return;
    setBulkSubmitting(true);
    try {
      const payload = bulkPreview.map((r) => ({
        program_id: programId,
        name: r.name,
        role: r.role,
        email: r.email ?? null,
        phone: r.phone ?? null,
      }));
      const { error } = await supabase.from('program_participants').insert(payload);
      if (error) throw error;
      setBulkOpen(false);
      setCsvText('');
      setBulkPreview([]);
      await reload();
      toast.success(`${payload.length}명이 등록됐어요.`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[participant-tab] 일괄 등록 실패:', raw);
      toast.error('일괄 등록 중 오류가 발생했어요.');
    } finally {
      setBulkSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 통계 */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-slate-600">총 <strong className="text-slate-800">{stats.total}</strong>명</span>
        <span className="text-violet-600">교육생 <strong>{stats.participant}</strong></span>
        <span className="text-blue-600">멘토 <strong>{stats.mentor}</strong></span>
        <span className="text-amber-600">고객사 <strong>{stats.client}</strong></span>
        <span className="text-emerald-600">수료 <strong>{stats.completed}</strong>명</span>
      </div>

      {/* 툴바 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                참여자 추가
              </Button>
              <Button variant="outline" size="sm" leftIcon={<FileUp size={14} />} onClick={() => setBulkOpen(true)}>
                CSV 일괄 등록
              </Button>
              <Button variant="outline" size="sm" leftIcon={<FileText size={14} />} onClick={() => setDocOpen(true)}>
                문서로 등록
              </Button>
            </>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 검색…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-violet-400" />
        </div>
      </div>

      {/* 추가 폼 (인라인 슬라이드) */}
      {addOpen && canEdit && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
          <h3 className="text-sm font-bold text-violet-700">새 참여자 추가</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="이름" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={adding} />
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">역할</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as ParticipantRole })}
                disabled={adding}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400">
                {PARTICIPANT_ROLE_VALUES.map((r) => (<option key={r} value={r}>{PARTICIPANT_ROLE_LABEL[r]}</option>))}
              </select>
            </div>
            <Input label="이메일" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={adding} />
            <Input label="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={adding} />
            <Input label="링크 만료일 (선택)" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              disabled={adding} helperText="비워두면 무기한" />
            <Input label="메모 (선택)" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} disabled={adding} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setForm(EMPTY_FORM); }} disabled={adding}>취소</Button>
            <Button variant="primary" size="sm" loading={adding} onClick={() => void handleAdd()}>등록하기</Button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-muted">
          <Loader2 size={14} className="animate-spin mr-2" /> 불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">
          {list.length === 0 ? '등록된 참여자가 없어요.' : '검색 결과가 없어요.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1.2fr)_60px_minmax(0,1fr)_minmax(0,1.2fr)_70px_minmax(140px,auto)] items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate">{p.name}</div>
                {p.memo && <div className="text-[10px] text-slate-400 truncate">{p.memo}</div>}
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center ${PARTICIPANT_ROLE_BADGE[p.role]}`}>
                {PARTICIPANT_ROLE_LABEL[p.role]}
              </span>
              <span className="text-xs text-slate-500 truncate">{p.phone ?? '-'}</span>
              <span className="text-xs text-slate-500 truncate">{p.email ?? '-'}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center ${
                p.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {p.status === 'completed' ? '수료' : '참여중'}
              </span>
              <div className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => void handleCopy(p)} aria-label="링크 복사"
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[10px] text-violet-700 hover:bg-violet-50">
                  <Copy size={11} aria-hidden="true" /> 링크
                </button>
                {canEdit && p.status !== 'completed' && (
                  <button type="button" onClick={() => void handleComplete(p)} aria-label="수료 처리"
                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50" title="수료 처리">
                    <CheckCircle2 size={12} aria-hidden="true" />
                  </button>
                )}
                {canEdit && (
                  <button type="button" onClick={() => void handleDelete(p)} aria-label="삭제"
                    className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500" title="삭제">
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* CSV 일괄 등록 모달 */}
      <Modal
        open={bulkOpen}
        onClose={() => { setBulkOpen(false); setCsvText(''); setBulkPreview([]); }}
        title="📋 CSV 일괄 등록"
        description="이름,이메일,연락처,역할 형식. 첫 줄 헤더 자동 감지·역할 한글(교육생·멘토·고객사·TA·참관) 영문 자동 변환."
        size="md"
        closeOnBackdrop={!bulkSubmitting}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSubmitting}>취소</Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={runCsvParse} disabled={!csvText.trim() || bulkSubmitting}>미리보기</Button>
              <Button variant="primary" loading={bulkSubmitting} disabled={bulkPreview.length === 0}
                onClick={() => void handleBulkInsert()}>
                {bulkPreview.length > 0 ? `${bulkPreview.length}명 일괄 등록하기` : '일괄 등록하기'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <textarea rows={8} value={csvText} onChange={(e) => setCsvText(e.target.value)}
            placeholder={`이름,이메일,연락처,역할\n홍길동,hong@test.com,010-1234-5678,교육생\n박멘토,park@test.com,010-2345-6789,멘토`}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 resize-none" />
          {bulkPreview.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 max-h-60 overflow-y-auto">
              <ul className="divide-y divide-slate-100">
                {bulkPreview.map((r, idx) => (
                  <li key={idx} className="grid grid-cols-[1fr_1.5fr_1fr_60px] items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="font-semibold text-slate-700 truncate">{r.name}</span>
                    <span className="text-slate-500 truncate">{r.email ?? '-'}</span>
                    <span className="text-slate-500 truncate">{r.phone ?? '-'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center ${PARTICIPANT_ROLE_BADGE[r.role]}`}>
                      {PARTICIPANT_ROLE_LABEL[r.role]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      <ParticipantDocImportModal
        open={docOpen}
        programId={programId}
        onSuccess={() => void reload()}
        onClose={() => setDocOpen(false)}
      />
    </div>
  );
}
