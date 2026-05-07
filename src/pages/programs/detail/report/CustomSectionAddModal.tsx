// bal24 v2 — 결과보고서 빌더 · 사용자 정의 섹션 추가 모달
// 제목 직접 입력 → custom 섹션 INSERT.

import { useEffect, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import { supabase } from '../../../../lib/supabase';
import { Field, inputClass } from '../../edit/cards/CardShell';

interface Props {
  open: boolean;
  onClose: () => void;
  programId: string;
  /** 현재 섹션 중 가장 큰 sort_order */
  maxSortOrder: number;
  onAdded: () => void;
}

export default function CustomSectionAddModal({
  open, onClose, programId, maxSortOrder, onAdded,
}: Props) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setTitle('');
  }, [open]);

  async function handleAdd() {
    const t = title.trim();
    if (!t) {
      toast.error('항목 제목을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const sectionKey = `custom_${Date.now().toString(36)}`;
      const { error } = await supabase.from('report_sections').insert({
        program_id: programId,
        section_key: sectionKey,
        title: t,
        content: null,
        is_visible: true,
        sort_order: maxSortOrder + 1,
        section_type: 'custom',
      });
      if (error) {
        console.error('[report-builder] custom 섹션 추가 실패:', error.message);
        toast.error('항목 추가에 실패했어요.');
        return;
      }
      toast.success('항목을 추가했어요.');
      onAdded();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="사용자 정의 항목 추가"
      description="교육·해외연수·이벤트 등 유형별 자유 섹션을 만들 수 있어요."
      size="brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!title.trim() || submitting}>
            {submitting ? '추가 중…' : '추가'}
          </Button>
        </>
      }
    >
      <Field label="항목 제목" required hint="예) 해외 인사이트 / 부스 운영 결과 / 미디어 노출 등">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          autoFocus
          className={inputClass}
        />
      </Field>
    </Modal>
  );
}
