// 홈 대시보드 최상단 기업 미션·비전 섹션 (박경수님 2026-05-27 STEP-HOME-CALENDAR-FIX)

import { Sparkles, Target } from 'lucide-react';

export default function MissionVisionSection() {
  return (
    <section
      className="rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-violet-800
                 text-white p-6 shadow-[0_8px_24px_rgba(124,58,237,0.20)]"
      aria-label="기업 미션·비전"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 미션 */}
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 shrink-0">
            <Target size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-200 mb-1">
              Mission
            </p>
            <p className="text-lg font-bold leading-snug">
              교육과 기술로 지역의 성장을 돕는다
            </p>
          </div>
        </div>

        {/* 비전 */}
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 shrink-0">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-200 mb-1">
              Vision
            </p>
            <p className="text-lg font-bold leading-snug">
              대한민국 최고의 교육 운영 플랫폼
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
