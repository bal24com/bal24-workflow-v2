// 견적서 제경비·기술료·부가세·최종금액 계산 유틸 — 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL (2026-05-27)

export interface EstimateAddonConfig {
  useOverhead: boolean;
  overheadLabel: string;
  overheadRate: number;
  useTechFee: boolean;
  techFeeLabel: string;
  techFeeRate: number;
  useVat: boolean;
  vatRate: number;
  finalProposalAmount: number | null;
}

export interface EstimateAddonResult {
  directTotal: number;
  overheadAmount: number;
  techFeeAmount: number;
  supplyTotal: number;
  vatAmount: number;
  grandTotal: number;
  roundedTotal: number;
}

/** 계산 — 직접비 + 제경비 + 기술료 = 공급가액 → 부가세 → 합계총액 → 만단위 절사 */
export function calcEstimateAddon(directTotal: number, cfg: EstimateAddonConfig): EstimateAddonResult {
  const overheadAmount = cfg.useOverhead ? Math.floor((directTotal * cfg.overheadRate) / 100) : 0;
  const techFeeAmount = cfg.useTechFee ? Math.floor((directTotal * cfg.techFeeRate) / 100) : 0;
  const supplyTotal = directTotal + overheadAmount + techFeeAmount;
  const vatAmount = cfg.useVat ? Math.floor((supplyTotal * cfg.vatRate) / 100) : 0;
  const grandTotal = supplyTotal + vatAmount;
  const roundedTotal = Math.floor(grandTotal / 10000) * 10000;
  return { directTotal, overheadAmount, techFeeAmount, supplyTotal, vatAmount, grandTotal, roundedTotal };
}

/** DB 저장 payload — project_estimates 테이블 컬럼 형식 */
export function buildAddonPayload(cfg: EstimateAddonConfig) {
  return {
    use_overhead: cfg.useOverhead,
    overhead_label: cfg.overheadLabel,
    overhead_rate: cfg.overheadRate,
    use_tech_fee: cfg.useTechFee,
    tech_fee_label: cfg.techFeeLabel,
    tech_fee_rate: cfg.techFeeRate,
    use_vat: cfg.useVat,
    vat_rate: cfg.vatRate,
    final_proposal_amount: cfg.finalProposalAmount,
  };
}

/** DB row → AddonConfig 변환 (안전한 default 처리) */
export function parseAddonConfig(row: Record<string, unknown> | null | undefined): EstimateAddonConfig {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    useOverhead: Boolean(r.use_overhead),
    overheadLabel: typeof r.overhead_label === 'string' ? r.overhead_label : '제경비',
    overheadRate: Number(r.overhead_rate ?? 0),
    useTechFee: Boolean(r.use_tech_fee),
    techFeeLabel: typeof r.tech_fee_label === 'string' ? r.tech_fee_label : '기술료',
    techFeeRate: Number(r.tech_fee_rate ?? 0),
    useVat: Boolean(r.use_vat),
    vatRate: Number(r.vat_rate ?? 10),
    finalProposalAmount: r.final_proposal_amount != null ? Number(r.final_proposal_amount) : null,
  };
}
