// bal24 v2 — 프로젝트 파일 탭 (STEP-STORAGE: SharedFilesTab 래퍼)

import SharedFilesTab from '../../../components/files/SharedFilesTab';

interface Props {
  projectId: string;
  /** @deprecated SharedFilesTab 가 useAuth 로 자체 fetch */
  uploaderId?: string;
}

export default function FilesTab({ projectId }: Props) {
  return (
    <SharedFilesTab
      bucket="project-files"
      fkColumn="project_id"
      fkValue={projectId}
    />
  );
}
