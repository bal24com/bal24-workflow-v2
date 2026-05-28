// 외주·급여 지급 상태 표시 표준 상수 (박경수님 2026-05-28 STEP-PAYROLL-UI-FIX).

export const PAYROLL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  draft:      { label: '대기',   color: 'slate'   },
  submitted:  { label: '대기',   color: 'slate'   },
  received:   { label: '대기',   color: 'amber'   },
  processing: { label: '처리중', color: 'blue'    },
  paid:       { label: '완료',   color: 'emerald' },
  cancelled:  { label: '반려',   color: 'rose'    },
  rejected:   { label: '반려',   color: 'rose'    },
};

export const STATUS_COLOR_CLASS: Record<string, string> = {
  slate:   'bg-slate-100 text-slate-700',
  amber:   'bg-amber-100 text-amber-700',
  blue:    'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose:    'bg-rose-100 text-rose-700',
};

export function getPayrollStatusBadge(status: string | null): { label: string; className: string } {
  const s = PAYROLL_STATUS_DISPLAY[status ?? 'draft'] ?? PAYROLL_STATUS_DISPLAY.draft;
  return { label: s.label, className: STATUS_COLOR_CLASS[s.color] ?? STATUS_COLOR_CLASS.slate };
}
