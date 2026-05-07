// bal24 v2 — 커리큘럼 템플릿 저장 모달 (Stage 3-C)
// 이름·설명 입력 + 차시 미리보기 + [저장] → curriculum_templates INSERT.

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { Field, inputClass, textareaClass } from '../../edit/cards/CardShell';
import { saveAsTemplate, type CurriculumSessionMeta } from './curriculumTemplateUtils';
import { trimTime } from './curriculumTabUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sessions: CurriculumSessionMeta[];
}

export default function SaveTemplateModal({ open, onClose, onSaved, sessions }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error('템플릿 이름을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await saveAsTemplate(name, description || null, sessions, user?.id ?? null);
      if (!res.ok) {
        toast.error(res.error ?? '템플릿 저장에 실패했어요.');
        return;
      }
      toast.success('템플릿을 저장했어요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="템플릿으로 저장"
      description="현재 커리큘럼을 다른 프로그램에서 재사용할 수 있게 묶음으로 저장해요."
      size="brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || sessions.length === 0 || submitting}
            leftIcon={<Save size={14} />}
          >
            {submitting ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="템플릿 이름" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 1일 워크숍 4차시 / 2박 3일 캠프 8차시"
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field label="설명" hint="선택 — 어떤 상황에 쓰는 템플릿인지 메모">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예) 신입 대상 디자인 씽킹 워크숍에 자주 쓰는 구성"
            className={textareaClass}
          />
        </Field>

        <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5">
          <p className="text-[11px] font-bold text-[#1E1B4B] mb-1.5">
            저장될 차시 ({sessions.length})
          </p>
          {sessions.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">
              저장할 차시가 없어요. 먼저 차시를 추가하고 저장해 주세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
              {sessions.map((s) => (
                <li
                  key={s.session_no}
                  className="flex items-center gap-2 text-[11px] text-slate-700"
                >
                  <span className="inline-flex items-center justify-center min-w-[2.2rem] h-5 px-1.5 rounded bg-violet-100 text-violet-700 text-[10px] font-bold tabular-nums">
                    {s.session_no}차시
                  </span>
                  <span className="flex-1 min-w-0 truncate">{s.title}</span>
                  {(s.start_time || s.end_time) && (
                    <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                      {trimTime(s.start_time)}
                      {s.end_time && `~${trimTime(s.end_time)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-slate-400">
            ⓘ 인력 매칭·차시 날짜는 저장 안 됨 (재사용 시 다시 매칭·날짜 입력)
          </p>
        </div>
      </div>
    </Modal>
  );
}
