// bal24 v2 — STEP-PARTICIPANTS-CSV-FIX
// CSV 일괄 등록 모달 (ParticipantTab에서 분리, V-1 400줄 유지용).

import { Modal, Button } from '../../../components/ui';
import {
  PARTICIPANT_ROLE_BADGE, PARTICIPANT_ROLE_LABEL,
  type ParsedParticipantRow,
} from '../../../lib/participantUtils';

interface Props {
  open: boolean;
  csvText: string;
  preview: ParsedParticipantRow[];
  submitting: boolean;
  onCsvChange: (v: string) => void;
  onPreview: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function ParticipantBulkCsvModal({
  open, csvText, preview, submitting,
  onCsvChange, onPreview, onSubmit, onClose,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📋 CSV 일괄 등록"
      description="이름,이메일,연락처,역할,소속,주민번호 (헤더 필수, 순서 무관). 역할: 교육생·멘토·고객사·TA·참관 → 자동 변환."
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onPreview} disabled={!csvText.trim() || submitting}>미리보기</Button>
            <Button variant="primary" loading={submitting} disabled={preview.length === 0}
              onClick={onSubmit}>
              {preview.length > 0 ? `${preview.length}명 일괄 등록하기` : '일괄 등록하기'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <textarea rows={8} value={csvText} onChange={(e) => onCsvChange(e.target.value)}
          placeholder={`이름,이메일,연락처,역할,소속,주민번호\n홍길동,hong@test.com,010-1234-5678,교육생,밸런스닷,900101-1234567\n박멘토,park@test.com,010-2345-6789,멘토`}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 resize-none" />
        {preview.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 max-h-60 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {preview.map((r, idx) => (
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
  );
}
