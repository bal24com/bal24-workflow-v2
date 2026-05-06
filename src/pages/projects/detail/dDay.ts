// bal24 v2 — D-day 계산 유틸
// 오늘 → "D-day" / 미래 → "D-N" / 과거 → "D+N" / null → null

export type DDay = {
  label: string;
  /** 음수: 미래 / 0: 오늘 / 양수: 지난 일수 */
  diffDays: number;
  /** 화면에서 강조용 — 오늘/지남 이면 true */
  urgent: boolean;
};

export function computeDDay(dueDateIso?: string | null, now: Date = new Date()): DDay | null {
  if (!dueDateIso) return null;

  const due = new Date(dueDateIso);
  if (Number.isNaN(due.getTime())) return null;

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOfDay(now) - startOfDay(due)) / msPerDay);

  let label: string;
  if (diffDays === 0) label = 'D-day';
  else if (diffDays < 0) label = `D${diffDays}`; // diffDays 음수 → "D-3"
  else label = `D+${diffDays}`;

  return { label, diffDays, urgent: diffDays >= 0 };
}
