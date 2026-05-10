// bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL 차시별 출석 링크 + 파일 업로드 섹션
//   각 차시에 외부 출석 폼 URL(구글폼) 저장 + QR 모달 + 차시별 출석부 스캔 파일 업로드

import { useCallback, useEffect, useState } from 'react';
import { Loader2, QrCode, ExternalLink, Save, Upload, FileText, X } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { Modal } from '../../../../components/ui';

interface Row {
  id: string; session_no: number; title: string;
  attendance_link: string | null;
  attendance_file_url: string | null;
}

interface Props { programId: string }

const BUCKET = 'attendance-files';

function qrUrl(link: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}`;
}

export default function AttendanceLinkSection({ programId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<{ no: number; link: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('program_curriculum')
      .select('id, session_no, title, attendance_link, attendance_file_url')
      .eq('program_id', programId).eq('curriculum_type', 'actual')
      .order('session_no');
    if (error) {
      console.error('[attend-link] 조회 실패:', error.message);
      toast.error('차시 목록을 불러오지 못했어요.');
      setRows([]); setLoading(false); return;
    }
    const next = (data ?? []) as Row[];
    setRows(next);
    setDrafts(Object.fromEntries(next.map((r) => [r.id, r.attendance_link ?? ''])));
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function saveLink(row: Row) {
    setSavingId(row.id);
    const link = (drafts[row.id] ?? '').trim() || null;
    const { error } = await supabase.from('program_curriculum')
      .update({ attendance_link: link }).eq('id', row.id);
    setSavingId(null);
    if (error) {
      console.error('[attend-link] 저장 실패:', error.message);
      toast.error('출석 링크 저장에 실패했어요.'); return;
    }
    toast.success('출석 링크를 저장했어요.');
    void refresh();
  }

  async function uploadFile(row: Row, file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error('파일 용량이 10MB를 초과해요.'); return; }
    setUploadingId(row.id);
    try {
      // STEP-SURVEY-FIX — Supabase Storage 키 ASCII 강제 (한글 키 거부)
      const ext = (file.name.includes('.') ? file.name.split('.').pop() : 'bin')!.replace(/[^a-z]/gi, '').toLowerCase();
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 40) || 'file';
      const path = `${programId}/${row.id}/${Date.now()}_${safeBase}.${ext || 'bin'}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (up.error) { console.error('[attend-link] 업로드 실패:', up.error.message); toast.error('파일 업로드 실패 (attendance-files 버킷 생성 확인)'); return; }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const upd = await supabase.from('program_curriculum').update({ attendance_file_url: url }).eq('id', row.id);
      if (upd.error) { console.error('[attend-link] URL 저장 실패:', upd.error.message); toast.error('파일 URL 저장에 실패했어요.'); return; }
      toast.success('출석부 파일을 등록했어요.');
      void refresh();
    } finally { setUploadingId(null); }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-violet-400" /></div>;
  if (rows.length === 0) return <p className="text-xs text-slate-400 italic text-center py-6">실제 운영 차시가 없어요. 커리큘럼 탭에서 [실제 운영]으로 차시를 등록한 후 이용해 주세요.</p>;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">차시별 외부 출석 폼 URL과 출석부 스캔 파일을 관리할 수 있어요. (실제 운영 차시 기준)</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
            <p className="text-xs font-bold text-slate-700">
              <span className="text-violet-600">{r.session_no}차시</span> {r.title || '(제목 없음)'}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <input type="url" value={drafts[r.id] ?? ''} placeholder="https://forms.google.com/…"
                onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                className="flex-1 min-w-[200px] h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400" />
              <button type="button" disabled={savingId === r.id} onClick={() => void saveLink(r)}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40">
                {savingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 저장
              </button>
              {r.attendance_link && (
                <>
                  <a href={r.attendance_link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200">
                    <ExternalLink size={11} /> 열기
                  </a>
                  <button type="button" onClick={() => setQrTarget({ no: r.session_no, link: r.attendance_link! })}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200">
                    <QrCode size={11} /> QR
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <label className="inline-flex items-center gap-1 cursor-pointer text-slate-600 hover:text-violet-700">
                <Upload size={11} /> {uploadingId === r.id ? '업로드 중…' : '출석부 파일'}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" hidden disabled={uploadingId === r.id}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadFile(r, f); }} />
              </label>
              {r.attendance_file_url && (
                <a href={r.attendance_file_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-violet-600 hover:underline">
                  <FileText size={11} /> 등록된 파일 보기
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {qrTarget && (
        <Modal open onClose={() => setQrTarget(null)} title={`${qrTarget.no}차시 출석 QR`} size="sm">
          <div className="flex flex-col items-center gap-2 py-2">
            <img src={qrUrl(qrTarget.link)} alt={`${qrTarget.no}차시 출석 QR 코드`} className="w-60 h-60 border border-slate-200 rounded-lg" />
            <p className="text-[11px] text-slate-500 break-all text-center max-w-[260px]">{qrTarget.link}</p>
            <button type="button" onClick={() => setQrTarget(null)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><X size={12} /> 닫기</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
