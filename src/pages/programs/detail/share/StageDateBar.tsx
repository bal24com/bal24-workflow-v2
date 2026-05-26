// bal24 v2 — 외부공유 단계 시작일 4 picker + 현재 단계 표시 (Stage 3-B-1)

import { Calendar, Save } from 'lucide-react';
import type { ShareStage } from '../../../../types/database';
import { SHARE_STAGE_LABEL } from './visibilityCatalog';
import type { SaveDatesPayload } from './shareUtils';

const STAGE_ORDER: ShareStage[] = ['pre', 'ready', 'progress', 'result'];

const STAGE_TONE: Record<ShareStage, string> = {
  before:   'bg-slate-100 text-slate-500',
  pre:      'bg-violet-100 text-violet-700',
  ready:    'bg-cyan-100 text-cyan-700',
  progress: 'bg-orange-100 text-orange-700',
  result:   'bg-emerald-100 text-emerald-700',
};

interface Props {
  draft: SaveDatesPayload;
  onChange: <K extends keyof SaveDatesPayload>(key: K, value: SaveDatesPayload[K]) => void;
  currentStage: ShareStage;
  stageDescription: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
}

export default function StageDateBar({
  draft, onChange, currentStage, stageDescription, dirty, saving, onSave,
}: Props) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-violet-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[#1E1B4B]">단계 시작일</h3>
          <p className="text-[11px] text-slate-500">PM이 직접 설정 — 현재 날짜 기준 자동 판별</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${STAGE_TONE[currentStage]}`}>
          현재 단계: {SHARE_STAGE_LABEL[currentStage]}
          {stageDescription && <span className="ml-1 opacity-70 font-normal">· {stageDescription}</span>}
        </span>
      </header>

      {/* 박경수님 + SkyClaw 2026-05-28 — 각 단계 시작일·종료일 2개 input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGE_ORDER.map((stage) => {
          const startKey = `${stage}_date` as keyof SaveDatesPayload;
          const endKey = `${stage}_end_date` as keyof SaveDatesPayload;
          const startVal = draft[startKey];
          const endVal = draft[endKey];
          return (
            <div key={stage} className="flex flex-col gap-1.5 rounded-xl border border-violet-100 bg-violet-50/30 p-2.5">
              <label className="text-[11px] font-bold text-slate-700 inline-flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${STAGE_TONE[stage].replace('text-', 'bg-').replace('-700', '-500').replace('-100', '-500').split(' ')[0]}`} aria-hidden="true" />
                {SHARE_STAGE_LABEL[stage]}
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500">시작일</span>
                <input type="date" value={startVal ?? ''}
                  onChange={(e) => onChange(startKey, e.target.value || null)}
                  className="h-8 px-2 rounded-md border border-violet-200 bg-white text-xs tabular-nums focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500">종료일</span>
                <input type="date" value={endVal ?? ''}
                  onChange={(e) => onChange(endKey, e.target.value || null)}
                  min={startVal ?? undefined}
                  className="h-8 px-2 rounded-md border border-violet-200 bg-white text-xs tabular-nums focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-violet-100">
        <p className="text-[11px] text-slate-500 mr-auto">
          {dirty ? (
            <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" aria-hidden="true" />
              저장 안 된 변경
            </span>
          ) : (
            <span className="text-slate-400">변경 없음</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={11} aria-hidden="true" />
          {saving ? '저장 중…' : '날짜 저장'}
        </button>
      </div>
    </section>
  );
}
