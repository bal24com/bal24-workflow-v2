// 견적서 헤더(title·memo) 수정 모달 (박경수님 요청)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  open: boolean;
  estimateId: string;
  currentTitle: string;
  currentMemo: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EstimateHeaderEditModal({ open, estimateId, currentTitle, currentMemo, onClose, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(currentTitle);
  const [memo, setMemo] = useState(currentMemo ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTitle(currentTitle); setMemo(currentMemo ?? ''); }
  }, [open, currentTitle, currentMemo]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('견적서 제목을 입력해 주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('project_estimates')
      .update({ title: title.trim(), memo: memo.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', estimateId);
    setSaving(false);
    if (error) {
      const raw = error.message.toLowerCase();
      toast.error(raw.includes('row-level security')
        ? `저장 권한이 없어요. 관리자에게 문의해 주세요.\n(${error.message})`
        : `저장 실패: ${error.message}`);
      return;
    }
    toast.success('견적서를 수정했어요.');
    onSaved(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="견적서 수정" size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
        <Button type="submit" form="est-header-edit" variant="primary" loading={saving}>저장</Button>
      </>}>
      <form id="est-header-edit" onSubmit={handleSubmit} className="space-y-3" noValidate>
        <Input label="견적서 제목" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving}
          placeholder="예) 2026 아이디어 스프린트 캠프 견적서" />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">메모 (선택)</label>
          <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} disabled={saving}
            placeholder="견적서 작성 배경·고객사 요청사항 등"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <p className="text-[11px] text-slate-500">항목별 편집은 견적 표에서 직접 수정 후 [저장] 버튼을 누르세요.</p>
      </form>
    </Modal>
  );
}
