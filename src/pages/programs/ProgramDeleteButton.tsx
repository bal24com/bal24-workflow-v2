// bal24 v2 — 프로그램 삭제 버튼 + 확인 모달 (헤더용 분리 컴포넌트)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  programId: string;
  programName: string;
}

export default function ProgramDeleteButton({ programId, programName }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from('programs').delete().eq('id', programId);
      if (error) throw error;
      toast.success('프로그램이 삭제됐어요.');
      navigate('/programs');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-detail] 삭제 실패:', raw);
      toast.error('삭제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl text-red-600 hover:bg-red-50 border border-red-200 transition">
        <Trash2 size={14} aria-hidden="true" />
        삭제
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-bold text-slate-900 text-lg mb-2">프로그램 삭제</h3>
            <p className="text-sm text-slate-600 mb-4">
              <span className="font-semibold text-red-600">{programName}</span>을 삭제하면 커리큘럼·참여자·강사 초대 등 연결된 모든 데이터가 함께 삭제돼요. 계속하시겠어요?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                취소
              </button>
              <button type="button" onClick={() => void handleDelete()} disabled={deleting}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-40">
                {deleting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
                {deleting ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
