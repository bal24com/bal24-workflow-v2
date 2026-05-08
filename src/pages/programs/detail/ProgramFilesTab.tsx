// bal24 v2 — 프로그램 파일 탭 (STEP-STORAGE: SharedFilesTab 래퍼, 신규)

import SharedFilesTab from '../../../components/files/SharedFilesTab';

interface Props {
  programId: string;
}

export default function ProgramFilesTab({ programId }: Props) {
  return (
    <SharedFilesTab
      bucket="program-files"
      fkColumn="program_id"
      fkValue={programId}
    />
  );
}
