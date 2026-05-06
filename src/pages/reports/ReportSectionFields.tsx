// bal24 v2 — 결과보고서 섹션 헬퍼 컴포넌트 (400줄 제한 준수)

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm text-text font-medium bg-slate-50 rounded-lg px-3 py-2">{value}</div>
    </div>
  );
}

export function TextareaField({
  label, value, onChange, disabled, rows = 3, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; rows?: number; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
      />
    </div>
  );
}
