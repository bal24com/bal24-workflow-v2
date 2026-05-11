// bal24 v2 — STEP-PHASE-DATE-FULL
// 개요 탭에 표시하는 외부공유 4단계 시작일 편집 카드 (StageDateBar 재사용)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import StageDateBar from './share/StageDateBar';
import {
  fetchOrSeedProgramShare, saveStageDates, detectStage, describeCurrentStage,
  type SaveDatesPayload,
} from './share/shareUtils';
import type { ProgramShare } from '../../../types/database';

interface Props { programId: string }

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PhaseDateSection({ programId }: Props) {
  const toast = useToast();
  const [share, setShare] = useState<ProgramShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<SaveDatesPayload>({
    pre_date: null, ready_date: null, progress_date: null, result_date: null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchOrSeedProgramShare(programId);
    if (!next) {
      toast.error('외부공유 정보를 불러오지 못했어요.');
      setLoading(false); return;
    }
    setShare(next);
    setDraft({
      pre_date: next.pre_date ?? null,
      ready_date: next.ready_date ?? null,
      progress_date: next.progress_date ?? null,
      result_date: next.result_date ?? null,
    });
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { if (programId) void refresh(); }, [programId, refresh]);

  function patchDraft<K extends keyof SaveDatesPayload>(key: K, value: SaveDatesPayload[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const now = todayIso();
  const currentStage = useMemo(() => share ? detectStage(now, share) : 'before', [share, now]);
  const stageDescription = useMemo(
    () => share ? describeCurrentStage(currentStage, share, now) : '',
    [share, currentStage, now],
  );

  const dirty = useMemo(() => {
    if (!share) return false;
    return draft.pre_date !== (share.pre_date ?? null)
      || draft.ready_date !== (share.ready_date ?? null)
      || draft.progress_date !== (share.progress_date ?? null)
      || draft.result_date !== (share.result_date ?? null);
  }, [draft, share]);

  async function handleSave() {
    setSaving(true);
    try {
      const ok = await saveStageDates(programId, draft);
      if (!ok) { toast.error('단계 시작일 저장에 실패했어요.'); return; }
      toast.success('단계 시작일을 저장했어요.');
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" />
        단계 시작일 불러오는 중…
      </div>
    );
  }

  return (
    <StageDateBar
      draft={draft}
      onChange={patchDraft}
      currentStage={currentStage}
      stageDescription={stageDescription}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    />
  );
}
