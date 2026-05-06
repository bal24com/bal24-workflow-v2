// bal24 v2 — 통합 일지 상세 보기 (읽기 전용 + 수정 진입)

import { useState } from 'react';
import { Edit3, FileIcon, ExternalLink, Loader2 } from 'lucide-react';
import { Badge, Modal, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import {
  ACTIVITY_FILES_BUCKET,
  LOG_TYPE_LABELS,
  extractStoragePath,
} from './activityLogTypes';
import type { ActivityFile, ActivityLog } from '../../types/database';

type LogRow = ActivityLog & {
  program?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  expert?: { id: string; name: string } | null;
};

type Props = {
  open: boolean;
  log: LogRow | null;
  onClose: () => void;
  onEdit: (log: LogRow) => void;
};

function fileSizeLabel(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(t?: string | null): string {
  return t ? t.slice(0, 5) : '';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm text-text font-medium">{children}</div>
    </div>
  );
}

function TextSection({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</h3>
      <p className="text-sm text-text whitespace-pre-wrap leading-relaxed bg-slate-50/60 rounded-lg p-3">{value}</p>
    </section>
  );
}

export default function ActivityLogDetailModal({ open, log, onClose, onEdit }: Props) {
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!log) return null;

  const handleOpenFile = async (f: ActivityFile) => {
    setErrorMsg(null);
    setOpeningFile(f.url);
    try {
      const path = extractStoragePath(f.url);
      if (!path) {
        setErrorMsg('파일 경로를 알 수 없어요. 관리자에게 문의해 주세요.');
        return;
      }
      const { data, error } = await supabase.storage
        .from(ACTIVITY_FILES_BUCKET)
        .createSignedUrl(path, 60);
      if (error || !data) {
        const m = error?.message?.toLowerCase() ?? '';
        if (m.includes('not found')) setErrorMsg('파일을 찾을 수 없어요.');
        else if (m.includes('row-level security')) setErrorMsg('파일 다운로드 권한이 없어요.');
        else setErrorMsg('파일 열기 중 오류가 발생했어요.');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[activity-log] 파일 열기 실패:', raw);
      setErrorMsg('파일 열기 중 오류가 발생했어요.');
    } finally {
      setOpeningFile(null);
    }
  };

  const files = log.file_urls ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={log.title}
      description={`${LOG_TYPE_LABELS[log.log_type]} · ${formatDateKo(log.activity_date)}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button variant="primary" leftIcon={<Edit3 size={14} />} onClick={() => onEdit(log)}>수정</Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기본 정보</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <Field label="유형">
              <Badge variant="primary">{LOG_TYPE_LABELS[log.log_type]}</Badge>
            </Field>
            <Field label="날짜">{formatDateKo(log.activity_date)}</Field>
            <Field label="시간">
              {(log.start_time || log.end_time)
                ? `${formatTime(log.start_time)}${log.end_time ? `~${formatTime(log.end_time)}` : ''}`
                : '–'}
              {log.duration_hours != null && <span className="text-xs text-muted ml-1">({log.duration_hours}h)</span>}
            </Field>
            <Field label="프로그램">{log.program?.name ?? '–'}</Field>
            <Field label="프로젝트">{log.project?.name ?? '–'}</Field>
            <Field label="전문가">{log.expert?.name ?? '–'}</Field>
            <Field label="장소">{log.location ?? '–'}</Field>
            <Field label="참석인원">{log.attendee_count != null ? `${log.attendee_count}명` : '–'}</Field>
          </dl>
        </section>

        <TextSection label="활동 내용" value={log.content} />
        <TextSection label="성과 및 결과" value={log.outcome} />
        <TextSection label="특이사항" value={log.issues} />
        <TextSection label="다음 계획" value={log.next_plan} />

        {files.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">첨부 파일 ({files.length})</h3>
            <ul className="space-y-1.5">
              {files.map((f, i) => (
                <li key={`${f.url}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                  <FileIcon size={16} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{f.name}</div>
                    {f.size != null && <div className="text-[10px] text-muted">{fileSizeLabel(f.size)}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleOpenFile(f)}
                    disabled={openingFile === f.url}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
                  >
                    {openingFile === f.url ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                    {openingFile === f.url ? '여는 중…' : '열기'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </div>
    </Modal>
  );
}
