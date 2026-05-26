// bal24 v2 — STEP-FEE-FORM-DOWNLOAD (박경수님 2026-05-26)
// 강사료 확인서 PDF 다운로드 훅. MentoringTab·StaffFeeTab 공용.
// 개별 다운로드(downloadingId) + 일괄 다운로드(batchProgress) 상태 + 핸들러 묶음.

import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  downloadFeeFormPDF, downloadAllFeeFormPDFs, type FeeFormData,
} from '../utils/feeFormPDF';

export interface UseFeeDownloadResult {
  downloadingId: string | null;
  batchProgress: { current: number; total: number } | null;
  /** 1건 다운로드. dataBuilder 는 비동기 (Supabase fetch 포함 가능). id 는 진행 표시용 식별자. */
  downloadOne: (id: string, dataBuilder: () => Promise<FeeFormData>) => Promise<void>;
  /** 다수 다운로드. items 각각 dataBuilder 호출 후 순차 PDF. */
  downloadMany: (items: Array<{ id: string; dataBuilder: () => Promise<FeeFormData> }>) => Promise<void>;
}

export function useFeeDownload(): UseFeeDownloadResult {
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  async function downloadOne(id: string, dataBuilder: () => Promise<FeeFormData>): Promise<void> {
    setDownloadingId(id);
    try {
      const data = await dataBuilder();
      await downloadFeeFormPDF(data);
      toast.success('강사료 확인서 PDF 다운로드가 시작됐어요.');
    } catch (err) {
      console.error('[useFeeDownload] PDF 실패:', err);
      toast.error('PDF 생성 중 오류가 발생했어요.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadMany(items: Array<{ id: string; dataBuilder: () => Promise<FeeFormData> }>): Promise<void> {
    if (items.length === 0) { toast.error('내려받을 항목이 없어요.'); return; }
    setBatchProgress({ current: 0, total: items.length });
    try {
      const list = await Promise.all(items.map((x) => x.dataBuilder()));
      await downloadAllFeeFormPDFs(list, (cur, total) => setBatchProgress({ current: cur, total }));
      toast.success(`강사료 확인서 ${list.length}건 다운로드 완료.`);
    } catch (err) {
      console.error('[useFeeDownload] 일괄 PDF 실패:', err);
      toast.error('일괄 다운로드 중 오류가 발생했어요.');
    } finally {
      setBatchProgress(null);
    }
  }

  return { downloadingId, batchProgress, downloadOne, downloadMany };
}
