// bal24 v2 — 프로젝트 상세 · 문서 탭 (4 내부 탭 컨테이너)

import { useState } from 'react';
import { FileText, ClipboardCheck, Package, FileBarChart } from 'lucide-react';
import DocFilesSection from './docs/DocFilesSection';
import AttendanceImportSection from './docs/AttendanceImportSection';
import DeliverablesSection from './docs/DeliverablesSection';
import FinalReportSection from './docs/FinalReportSection';

type DocsTabKey = 'files' | 'attendance' | 'deliverables' | 'report';

interface Props {
  projectId: string;
}

const TABS: { key: DocsTabKey; label: string; Icon: typeof FileText }[] = [
  { key: 'files',        label: '견적서·운영안', Icon: FileText },
  { key: 'attendance',   label: '출석부',         Icon: ClipboardCheck },
  { key: 'deliverables', label: '산출물',         Icon: Package },
  { key: 'report',       label: '결과보고서',     Icon: FileBarChart },
];

export default function ProjectDocsTab({ projectId }: Props) {
  const [tab, setTab] = useState<DocsTabKey>('files');

  return (
    <div className="space-y-4">
      <nav role="tablist" aria-label="문서 내부 탭"
        className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} type="button" role="tab" aria-selected={active}
              onClick={() => setTab(key)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {tab === 'files'        && <DocFilesSection        projectId={projectId} />}
        {tab === 'attendance'   && <AttendanceImportSection projectId={projectId} />}
        {tab === 'deliverables' && <DeliverablesSection    projectId={projectId} />}
        {tab === 'report'       && <FinalReportSection     projectId={projectId} />}
      </div>
    </div>
  );
}
