// 프로젝트 수정 모달 — 연결된 income_contracts 인라인 편집 섹션 (박경수님 + SkyClaw PART B)
// 계약명·계약금액·단계(lifecycle_stage)·상태 인라인 편집. 저장은 부모 모달의 handleSubmit 에서 일괄 처리.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ContractLifecycleStage, ContractStatus } from '../../types/database';

export interface ContractDraft {
  id: string;
  contract_name: string;
  contract_amount: number;
  lifecycle_stage: ContractLifecycleStage | null;
  status: ContractStatus;
  // 원본값 — 비교용
  _original: {
    contract_name: string;
    contract_amount: number;
    lifecycle_stage: ContractLifecycleStage | null;
    status: ContractStatus;
  };
}

interface Props {
  projectId: string;
  open: boolean;
  drafts: ContractDraft[];
  onChange: (drafts: ContractDraft[]) => void;
  disabled?: boolean;
}

const LIFECYCLE_OPTIONS: { value: ContractLifecycleStage; label: string }[] = [
  { value: 'proposal',  label: '견적·제안' },
  { value: 'contract',  label: '계약' },
  { value: 'operation', label: '운영' },
  { value: 'closing',   label: '종료' },
];

const STATUS_OPTIONS: ContractStatus[] = ['draft', '진행중', '완료', '취소', '보류'];

export default function ProjectFormContractFields({ projectId, open, drafts, onChange, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    void (async () => {
      const { data, error } = await supabase
        .from('income_contracts')
        .select('id, contract_name, contract_amount, lifecycle_stage, status')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at');
      if (cancelled) return;
      if (error) {
        console.error('[ProjectFormContractFields] 계약 조회 실패:', error.message);
        setErrorMsg('연결된 계약을 불러오지 못했어요.');
      } else {
        const list: ContractDraft[] = (data ?? []).map((c) => ({
          id: c.id,
          contract_name: c.contract_name,
          contract_amount: Number(c.contract_amount ?? 0),
          lifecycle_stage: c.lifecycle_stage,
          status: c.status,
          _original: {
            contract_name: c.contract_name,
            contract_amount: Number(c.contract_amount ?? 0),
            lifecycle_stage: c.lifecycle_stage,
            status: c.status,
          },
        }));
        onChange(list);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  // onChange 는 부모 setter 라 deps 에서 제외 (무한루프 방지)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  function patch(id: string, p: Partial<ContractDraft>) {
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-muted inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        연결된 계약을 불러오는 중…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-xs text-danger">
        {errorMsg}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-muted">
        이 프로젝트에 연결된 계약이 아직 없어요. (프로젝트 등록 시 자동 생성되며, 수입/계약 페이지에서도 신규 등록할 수 있어요.)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((d) => (
        <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <input type="text" value={d.contract_name} disabled={disabled}
            onChange={(e) => patch(d.id, { contract_name: e.target.value })}
            placeholder="계약명"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input type="text" inputMode="numeric" value={String(d.contract_amount)}
              disabled={disabled}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^0-9.-]/g, ''));
                patch(d.id, { contract_amount: Number.isNaN(n) ? 0 : n });
              }}
              placeholder="계약금액"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            <select value={d.lifecycle_stage ?? 'proposal'} disabled={disabled}
              onChange={(e) => patch(d.id, { lifecycle_stage: e.target.value as ContractLifecycleStage })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={d.status} disabled={disabled}
              onChange={(e) => patch(d.id, { status: e.target.value as ContractStatus })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

// 부모 모달에서 한꺼번에 저장하기 위한 헬퍼 — 변경된 필드만 UPDATE.
export async function saveContractDrafts(drafts: ContractDraft[]): Promise<{ ok: true } | { ok: false; reason: string }> {
  const nowIso = new Date().toISOString();
  for (const d of drafts) {
    const diff: Record<string, string | number | null> = {};
    if (d.contract_name !== d._original.contract_name) diff.contract_name = d.contract_name;
    if (d.contract_amount !== d._original.contract_amount) diff.contract_amount = d.contract_amount;
    if (d.lifecycle_stage !== d._original.lifecycle_stage) diff.lifecycle_stage = d.lifecycle_stage;
    if (d.status !== d._original.status) diff.status = d.status;
    if (Object.keys(diff).length === 0) continue;
    diff.updated_at = nowIso;
    const { error } = await supabase.from('income_contracts').update(diff).eq('id', d.id);
    if (error) {
      console.error('[saveContractDrafts] 실패:', error.message);
      return { ok: false, reason: error.message };
    }
  }
  return { ok: true };
}
