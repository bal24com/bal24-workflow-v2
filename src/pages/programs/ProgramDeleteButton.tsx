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
  // STEP-PROGRAM-DELETE-FIX — FK 제약 시 자세한 에러 메시지 + 모달 유지
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function translateDeleteError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes('foreign key') || m.includes('violates') || m.includes('23503')) {
      return 'FK 제약 — 이 프로그램에 연결된 자식 데이터(커리큘럼·참여자·초대·일지 등)가 있어서 삭제할 수 없어요. Supabase SQL Editor에서 자식 데이터를 먼저 삭제해 주세요. (PM 문의)';
    }
    if (m.includes('row-level security') || m.includes('permission denied')) {
      return '삭제 권한이 없어요. 관리자에게 문의해 주세요.';
    }
    return raw ? `삭제 실패: ${raw}` : '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.';
  }

  async function handleDelete() {
    setDeleting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from('programs').delete().eq('id', programId);
      if (error) throw error;
      toast.success('프로그램이 삭제됐어요.');
      setOpen(false);
      navigate('/programs');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-detail] 삭제 실패:', raw);
      const msg = translateDeleteError(raw);
      setErrorMsg(msg);
      toast.error(msg);
      // 모달 유지 (박경수님이 에러를 확인할 수 있게)
    } finally {
      setDeleting(false);
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
            {errorMsg && (
              <div role="alert" className="mb-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 whitespace-pre-wrap">
                {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setOpen(false); setErrorMsg(null); }} disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                {errorMsg ? '닫기' : '취소'}
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
