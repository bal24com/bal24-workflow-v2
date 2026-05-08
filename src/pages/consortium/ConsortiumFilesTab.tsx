// bal24 v2 — 컨소시엄 파일 탭 (STEP-STORAGE: SharedFilesTab 래퍼)

import SharedFilesTab from '../../components/files/SharedFilesTab';

interface Props {
  consortiumId: string;
  /** @deprecated SharedFilesTab 가 useAuth 로 자체 fetch — 외부 주입 불필요 */
  uploaderId?: string;
}

export default function ConsortiumFilesTab({ consortiumId }: Props) {
  return (
    <SharedFilesTab
      bucket="consortium-files"
      fkColumn="consortium_id"
      fkValue={consortiumId}
    />
  );
}
