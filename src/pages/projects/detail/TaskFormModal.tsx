// bal24 v2 — 태스크 신규 등록 모달
// 공통 Modal + Input + Button 사용. tasks 테이블에 직접 INSERT.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { TASK_STATUS_VALUES } from './taskStatus';
import type { Profile, TaskStatus } from '../../../types/database';

type ProfileOption = Pick<Profile, 'id' | 'name'>;
type ConsortiumOption = { id: string; name: string };
type MemberOption = { id: string; client_name: string };

type Props = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
  defaultConsortiumId?: string;
};

export default function TaskFormModal({ open, projectId, onClose, onCreated, defaultConsortiumId }: Props) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('인식');
  const [assigneeId, setAssigneeId] = useState('');
  const [consortiumId, setConsortiumId] = useState(defaultConsortiumId ?? '');
  const [memberId, setMemberId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [consortiums, setConsortiums] = useState<ConsortiumOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingRefs(true);

    Promise.all([
      supabase.from('profiles').select('id, name').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('consortiums').select('id, name').in('status', ['구성중', '진행']).order('name', { ascending: true }),
    ])
      .then(([profRes, conRes]) => {
        if (cancelled) return;
        if (profRes.error) {
          console.error('[tasks] 담당자 조회 실패:', profRes.error.message);
        } else {
          setProfiles(profRes.data ?? []);
        }
        if (conRes.error) {
          console.error('[tasks] 컨소시엄 조회 실패:', conRes.error.message);
        } else {
          setConsortiums((conRes.data as ConsortiumOption[] | null) ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // 컨소시엄 변경 시 참여사 cascade 조회
  useEffect(() => {
    if (!consortiumId) {
      setMembers([]);
      setMemberId('');
      return;
    }
    let cancelled = false;
    setLoadingMembers(true);
    void (async () => {
      const { data, error } = await supabase
        .from('consortium_members')
        .select('id, clients!consortium_members_client_id_fkey(name)')
        .eq('consortium_id', consortiumId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[tasks] 참여사 조회 실패:', error.message);
        setMembers([]);
      } else {
        // Supabase는 inner join 객체를 단일 또는 배열 형태로 반환할 수 있음 — 둘 다 안전 처리
        const rows = (data as unknown as Array<{
          id: string;
          clients: { name: string } | { name: string }[] | null;
        }>) ?? [];
        setMembers(
          rows.map((m) => {
            const c = Array.isArray(m.clients) ? m.clients[0] : m.clients;
            return { id: m.id, client_name: c?.name ?? '이름 없음' };
          }),
        );
      }
      setLoadingMembers(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [consortiumId]);

  useEffect(() => {
    if (open) return;
    // 모달 닫히면 폼 초기화
    setTitle('');
    setStatus('인식');
    setAssigneeId('');
    setConsortiumId(defaultConsortiumId ?? '');
    setMemberId('');
    setStartDate('');
    setDueDate('');
    setDescription('');
    setTitleError(null);
    setErrorMsg(null);
  }, [open, defaultConsortiumId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTitleError(null);
    setErrorMsg(null);

    if (!title.trim()) {
      setTitleError('태스크명을 입력해 주세요.');
      return;
    }
    if (startDate && dueDate && startDate > dueDate) {
      setErrorMsg('마감일이 시작일보다 빠를 수 없어요.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        project_id: projectId,
        title: title.trim(),
        status,
        assignee_id: assigneeId || null,
        consortium_id: consortiumId || null,
        consortium_member_id: memberId || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        description: description.trim() || null,
      });

      if (error) throw error;

      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[tasks] 등록 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('start_date') && m.includes('column')) {
        setErrorMsg('시작일 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else if (m.includes('row-level security') || m.includes('permission denied')) {
        setErrorMsg('태스크를 등록할 권한이 없어요. 관리자에게 문의해 주세요.');
      } else {
        setErrorMsg('태스크 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="태스크 신규 등록"
      description="필수 항목은 태스크명만 입력하면 돼요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="submit" form="task-form" variant="primary" loading={submitting}>
            저장하기
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="태스크명"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          error={titleError}
          placeholder="예) 강사 최종 확정 및 커리큘럼 수령"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {TASK_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">담당자</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              컨소시엄 <span className="text-xs font-normal text-slate-400">(선택)</span>
            </label>
            <select
              value={consortiumId}
              onChange={(e) => setConsortiumId(e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">연결 안 함</option>
              {consortiums.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              참여사 <span className="text-xs font-normal text-slate-400">(선택)</span>
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              disabled={submitting || !consortiumId || loadingMembers || members.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">
                {!consortiumId
                  ? '컨소시엄을 먼저 선택하세요'
                  : loadingMembers
                    ? '불러오는 중…'
                    : members.length === 0
                      ? '참여사 없음'
                      : '참여사 선택'}
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.client_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="시작일"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={submitting}
          />
          <Input
            type="date"
            label="마감일"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
            helperText="비우면 D-day 표시 없음"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="task-desc" className="text-sm font-semibold text-slate-700">설명</label>
          <textarea
            id="task-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            placeholder="태스크 세부 내용·체크리스트·참고 링크 등"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
          />
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
