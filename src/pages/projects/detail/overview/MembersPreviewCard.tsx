// bal24 v2 — 프로젝트 개요 · 참여자 미니 프리뷰 (V7 차용)
// PM·고객사·참여인력 요약. 풀버전은 "참여인력" 탭에서.

import { useEffect, useState } from 'react';
import { Users, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { fetchProjectMembersPreview, type ProjectMembersPreview } from '../projectDetailUtils';

interface Props {
  projectId: string;
  pmName: string | null;
  clientName: string | null;
  /** 부모 ProjectDetailPage에서 setTab으로 직접 전환 */
  onOpenMembersTab?: () => void;
}

export default function MembersPreviewCard({
  projectId,
  pmName,
  clientName,
  onOpenMembersTab,
}: Props) {
  const toast = useToast();
  const [preview, setPreview] = useState<ProjectMembersPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchProjectMembersPreview(projectId, 4);
        if (cancelled) return;
        setPreview(res);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[project-detail] 참여자 미리보기 실패:', raw);
        toast.error('참여자 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Users size={16} className="text-violet-500" aria-hidden="true" />
          참여자
        </h3>
        {onOpenMembersTab && (
          <button
            type="button"
            onClick={onOpenMembersTab}
            className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
          >
            참여인력 탭 열기
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        )}
      </header>

      <Row label="담당자 (PM)" value={pmName ?? '미지정'} placeholder={!pmName} />
      <Row label="고객사" value={clientName ?? '미지정'} placeholder={!clientName} />

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          참여 인력
        </p>
        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 className="animate-spin" size={12} aria-hidden="true" />
            불러오는 중…
          </div>
        ) : !preview || preview.totalCount === 0 ? (
          <p className="text-xs text-slate-400 italic">아직 배정된 인력이 없어요.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {preview.recentNames.map((n) => (
              <span
                key={n}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200"
              >
                {n}
              </span>
            ))}
            {preview.totalCount > preview.recentNames.length && (
              <span className="text-[11px] text-slate-500">
                +{preview.totalCount - preview.recentNames.length}명
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, value, placeholder }: { label: string; value: string; placeholder?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span
        className={`text-sm font-semibold truncate ${
          placeholder ? 'text-slate-400 italic font-normal' : 'text-[#1E1B4B]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
