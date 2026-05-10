// bal24 v2 — STEP-EXPERT-CRUD-FULL 전문가 확장 필드 섹션
// 학력·경력·자격증 동적 입력 + resume_url + staff_type select

import { Plus, X } from 'lucide-react';
import { Input } from '../../components/ui';
import type { CareerItem, CertItem, EducationItem, StaffType } from '../../types/database';

const STAFF_TYPES: StaffType[] = ['강사', '멘토', 'FT', 'TA', '운영진', '기타'];

interface Props {
  staffType: StaffType | '';
  resumeUrl: string;
  educations: EducationItem[];
  careers: CareerItem[];
  certs: CertItem[];
  disabled?: boolean;
  onStaffType: (v: StaffType | '') => void;
  onResumeUrl: (v: string) => void;
  onEducations: (next: EducationItem[]) => void;
  onCareers: (next: CareerItem[]) => void;
  onCerts: (next: CertItem[]) => void;
}

const sectionH = 'text-xs font-bold text-slate-500 uppercase tracking-wide';
const addBtn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-dashed border-violet-300 disabled:opacity-40';
const rowWrap = 'grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_28px] gap-2 items-end';

export default function ExpertFormExtSection({
  staffType, resumeUrl, educations, careers, certs, disabled,
  onStaffType, onResumeUrl, onEducations, onCareers, onCerts,
}: Props) {
  return (
    <>
      <section className="space-y-3">
        <h3 className={sectionH}>주 역할·이력서</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">주 역할</label>
            <select value={staffType} disabled={disabled}
              onChange={(e) => onStaffType(e.target.value as StaffType | '')}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
              <option value="">미지정</option>
              {STAFF_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <Input label="이력서 URL" value={resumeUrl} disabled={disabled}
            onChange={(e) => onResumeUrl(e.target.value)} placeholder="https://…"
            helperText="외부 PDF/Notion 링크 (선택)" />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={sectionH}>학력 ({educations.length})</h3>
          <button type="button" disabled={disabled} className={addBtn}
            onClick={() => onEducations([...educations, { school: '', major: '', degree: '', year: '' }])}>
            <Plus size={11} aria-hidden="true" /> 추가
          </button>
        </div>
        {educations.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">등록된 학력이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {educations.map((e, i) => (
              <div key={i} className={rowWrap}>
                <Input label={i === 0 ? '학교' : ''} value={e.school} disabled={disabled}
                  onChange={(ev) => onEducations(educations.map((x, j) => j === i ? { ...x, school: ev.target.value } : x))} placeholder="학교명" />
                <Input label={i === 0 ? '전공/학위' : ''} value={e.major} disabled={disabled}
                  onChange={(ev) => onEducations(educations.map((x, j) => j === i ? { ...x, major: ev.target.value } : x))} placeholder="전공" />
                <Input label={i === 0 ? '연도' : ''} value={e.year} disabled={disabled}
                  onChange={(ev) => onEducations(educations.map((x, j) => j === i ? { ...x, year: ev.target.value } : x))} placeholder="2020 졸업" />
                <button type="button" disabled={disabled} aria-label="학력 삭제"
                  onClick={() => onEducations(educations.filter((_, j) => j !== i))}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40">
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={sectionH}>경력 ({careers.length})</h3>
          <button type="button" disabled={disabled} className={addBtn}
            onClick={() => onCareers([...careers, { company: '', role: '', period: '' }])}>
            <Plus size={11} aria-hidden="true" /> 추가
          </button>
        </div>
        {careers.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">등록된 경력이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {careers.map((c, i) => (
              <div key={i} className={rowWrap}>
                <Input label={i === 0 ? '회사·기관' : ''} value={c.company} disabled={disabled}
                  onChange={(ev) => onCareers(careers.map((x, j) => j === i ? { ...x, company: ev.target.value } : x))} placeholder="회사명" />
                <Input label={i === 0 ? '직책·역할' : ''} value={c.role} disabled={disabled}
                  onChange={(ev) => onCareers(careers.map((x, j) => j === i ? { ...x, role: ev.target.value } : x))} placeholder="대표·교수 등" />
                <Input label={i === 0 ? '기간' : ''} value={c.period} disabled={disabled}
                  onChange={(ev) => onCareers(careers.map((x, j) => j === i ? { ...x, period: ev.target.value } : x))} placeholder="2021.03~현재" />
                <button type="button" disabled={disabled} aria-label="경력 삭제"
                  onClick={() => onCareers(careers.filter((_, j) => j !== i))}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40">
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={sectionH}>자격·수상 ({certs.length})</h3>
          <button type="button" disabled={disabled} className={addBtn}
            onClick={() => onCerts([...certs, { name: '', issuer: '', year: '' }])}>
            <Plus size={11} aria-hidden="true" /> 추가
          </button>
        </div>
        {certs.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">등록된 자격·수상이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {certs.map((c, i) => (
              <div key={i} className={rowWrap}>
                <Input label={i === 0 ? '명칭' : ''} value={c.name} disabled={disabled}
                  onChange={(ev) => onCerts(certs.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))} placeholder="자격증·상명" />
                <Input label={i === 0 ? '발급/주관' : ''} value={c.issuer} disabled={disabled}
                  onChange={(ev) => onCerts(certs.map((x, j) => j === i ? { ...x, issuer: ev.target.value } : x))} placeholder="발급기관" />
                <Input label={i === 0 ? '연도' : ''} value={c.year} disabled={disabled}
                  onChange={(ev) => onCerts(certs.map((x, j) => j === i ? { ...x, year: ev.target.value } : x))} placeholder="2024" />
                <button type="button" disabled={disabled} aria-label="자격 삭제"
                  onClick={() => onCerts(certs.filter((_, j) => j !== i))}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40">
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
