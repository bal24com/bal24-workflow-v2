// bal24 v2 — STEP-PARTICIPANT-PORTAL PM용 참여자 관리 탭

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, FileUp, Search, FileText, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal, Button, Input } from '../../../components/ui';
import ParticipantDocImportModal from './ParticipantDocImportModal';
import ParticipantEditableTable from './ParticipantEditableTable';
import BulkActionBar from '../../../components/BulkActionBar';
import { useBulkSelect } from '../../../hooks/useBulkSelect';
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
    // STEP-PARTICIPANTS-LIST-UPDATE — display_order 우선, 같으면 created_at asc
    const { data, error } = await supabase
      .from('program_participants').select('*')
      .eq('program_id', programId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
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

  // STEP-PARTICIPANT-BULK-DELETE — 다중 선택 일괄 삭제
  const { selectedIds, allSelected, toggleAll, toggleOne, clearSelection } = useBulkSelect(visible);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size}명의 교육생을 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('program_participants').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) {
      console.error('[participant-tab] 일괄 삭제 실패:', error.message);
      toast.error('삭제 중 오류가 발생했어요.');
      return;
    }
    toast.success(`${ids.length}명을 삭제했어요.`);
    clearSelection();
    void reload();
  }

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

  // STEP-PROGRAM-ENHANCE-FULL — 행별 액션(편집/수료/삭제/복사)은 ParticipantEditableTable로 이관

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
        organization: r.organization ?? null,
        id_number: r.id_number ? r.id_number.replace(/[^0-9]/g, '') : null,
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
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <>
              <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>참여자 추가</Button>
              <Button variant="outline" size="sm" leftIcon={<FileUp size={14} />} onClick={() => setBulkOpen(true)}>CSV 일괄 등록</Button>
              <Button variant="outline" size="sm" leftIcon={<FileText size={14} />} onClick={() => setDocOpen(true)}>문서로 등록</Button>
            </>
          )}
          {/* STEP-PROGRAM-ENHANCE-FULL — xlsx 다운로드 */}
          <Button variant="outline" size="sm" leftIcon={<Download size={14} />}
            disabled={list.length === 0}
            onClick={() => {
              const rows = list.map((p, i) => ({
                '번호': i + 1, '이름': p.name, '소속': p.organization ?? '',
                '연락처': p.phone ?? '', '이메일': p.email ?? '',
                '주민번호': p.id_number ? p.id_number.replace(/^(\d{6})(\d)\d*$/, '$1-$2******') : '',
                '상태': p.status,
              }));
              const ws = XLSX.utils.json_to_sheet(rows);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, '교육생명단');
              XLSX.writeFile(wb, `participants_${programId.slice(0,8)}.xlsx`);
            }}>
            엑셀 다운로드
          </Button>
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
        // STEP-PROGRAM-ENHANCE-FULL — 인라인 편집 테이블 (이름·소속·연락처·주민번호·상태)
        // STEP-PARTICIPANT-BULK-DELETE — 다중 선택 prop 추가
        <ParticipantEditableTable list={visible} canEdit={canEdit} onChanged={() => void reload()}
          selectedIds={canEdit ? selectedIds : undefined}
          onToggleOne={canEdit ? toggleOne : undefined}
          allSelected={canEdit ? allSelected : undefined}
          onToggleAll={canEdit ? toggleAll : undefined} />
      )}

      {/* STEP-PARTICIPANT-BULK-DELETE — 하단 fixed 액션 바 */}
      {canEdit && (
        <BulkActionBar count={selectedIds.size} busy={bulkDeleting} itemLabel="명"
          onDelete={() => void handleBulkDelete()} onCancel={clearSelection} />
      )}

      {/* CSV 일괄 등록 모달 */}
      <Modal
        open={bulkOpen}
        onClose={() => { setBulkOpen(false); setCsvText(''); setBulkPreview([]); }}
        title="📋 CSV 일괄 등록"
        description="이름,이메일,연락처,역할,소속,주민번호 (헤더 필수, 순서 무관). 역할: 교육생·멘토·고객사·TA·참관 → 자동 변환."
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
            placeholder={`이름,이메일,연락처,역할,소속,주민번호\n홍길동,hong@test.com,010-1234-5678,교육생,밸런스닷,900101-1234567\n박멘토,park@test.com,010-2345-6789,멘토`}
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
