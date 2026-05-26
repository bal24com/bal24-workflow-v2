// bal24 v2 — 박경수님 2026-05-26 멘토링 일지 펼침 뷰 (StaffLogTab 분리).
// 일지 id 받아서 풀 데이터 fetch + 양식 표 렌더. fetch 캐싱은 부모가 담당.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchLogForPdf } from '../../programs/detail/mentoringLogPdfFetch';
import type { MentoringLogForPdf } from '../../programs/detail/mentoringLogPdf';
import MentoringLogDetailTable from './MentoringLogDetailTable';

interface Props {
  logId: string;
  // fallback (fetch 전에라도 보여줄 기본값)
  fallback: {
    teamName: string | null | undefined;
    subject: string | null | undefined;
    content: string;
    date: string;
    startTime: string | null | undefined;
    endTime: string | null | undefined;
    durationMin: number | null | undefined;
    recipient: string | null | undefined;
    menteeNames: string[] | undefined;
    programName: string | null;
    mentorName: string;
    mentorAffiliation: string | null;
  };
  cached?: MentoringLogForPdf;
  onLoaded?: (d: MentoringLogForPdf) => void;
}

export default function MentoringLogExpandedView({ logId, fallback, cached, onLoaded }: Props) {
  const [detail, setDetail] = useState<MentoringLogForPdf | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  // 박경수님 2026-05-26 PART A — 멘토링 일지 photo_urls 추가 fetch (mentoring_log_files 와 별개)
  const [extraPhotoUrls, setExtraPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (cached) { setDetail(cached); setLoading(false); }
    let cancelled = false;
    if (!cached) setLoading(true);
    void (async () => {
      // 1) PDF용 풀 데이터 (mentor info + image_urls from mentoring_log_files)
      if (!cached) {
        const d = await fetchLogForPdf(logId);
        if (!cancelled) {
          setDetail(d);
          setLoading(false);
          if (d && onLoaded) onLoaded(d);
        }
      }
      // 2) photo_urls JSONB 추가 fetch (PART A — 신규 사진 시스템)
      const { data: row } = await supabase.from('mentoring_logs')
        .select('photo_urls').eq('id', logId).maybeSingle();
      if (cancelled) return;
      const arr = (row?.photo_urls ?? []) as Array<{ url?: string } | string>;
      const urls = arr
        .map((p) => (typeof p === 'string' ? p : p?.url ?? ''))
        .filter((u): u is string => !!u);
      setExtraPhotoUrls(urls);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId, cached]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <MentoringLogDetailTable
      programName={detail?.program_name ?? fallback.programName}
      projectName={detail?.project_name ?? null}
      mentorName={detail?.mentor_name ?? fallback.mentorName}
      mentorOrg={detail?.mentor_org ?? fallback.mentorAffiliation}
      mentorPosition={detail?.mentor_position ?? null}
      mentorSignatureUrl={detail?.mentor_signature_url ?? null}
      teamName={fallback.teamName}
      menteeNames={detail?.mentee_names ?? fallback.menteeNames}
      date={fallback.date}
      startTime={fallback.startTime}
      endTime={fallback.endTime}
      durationMin={fallback.durationMin}
      subject={fallback.subject}
      content={fallback.content}
      imageUrls={[...(detail?.image_urls ?? []), ...extraPhotoUrls]}
      recipient={fallback.recipient}
    />
  );
}
