// bal24 v2 — STEP-MENTORING-LOG-UX
// 시·분 분리 드롭다운 — 모바일 시계 UI 회피.
// 분은 10분 단위 (00·10·20·30·40·50).

interface Props {
  value: string;                          // "HH:MM"
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '10', '20', '30', '40', '50'];

function splitHHMM(v: string | null | undefined): [string, string] {
  const safe = (v ?? '09:00').trim();
  const [h, m] = safe.split(':');
  const hh = HOURS.includes(h) ? h : '09';
  // 분을 가장 가까운 10분 단위로 스냅
  const minNum = Number.isFinite(Number(m)) ? Number(m) : 0;
  const snapped = String(Math.floor(minNum / 10) * 10).padStart(2, '0');
  const mm = MINUTES.includes(snapped) ? snapped : '00';
  return [hh, mm];
}

const SELECT_CLASS =
  'h-[42px] border border-gray-200 rounded-[10px] px-2 text-sm tabular-nums bg-white ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 ' +
  'disabled:bg-slate-50 disabled:opacity-70';

export default function TimeSelect({ value, onChange, disabled, ariaLabel }: Props) {
  const [h, m] = splitHHMM(value);
  return (
    <div className="inline-flex items-center gap-1" aria-label={ariaLabel}>
      <select value={h} disabled={disabled}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className={SELECT_CLASS}
        aria-label={ariaLabel ? `${ariaLabel} 시` : '시'}>
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>{hh}시</option>
        ))}
      </select>
      <span className="text-slate-400 text-sm">:</span>
      <select value={m} disabled={disabled}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className={SELECT_CLASS}
        aria-label={ariaLabel ? `${ariaLabel} 분` : '분'}>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>{mm}분</option>
        ))}
      </select>
    </div>
  );
}
