// bal24 WorkFlow v2 — STEP 1 임시 진입점
// STEP 3에서 라우팅·인증·레이아웃으로 교체 예정

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="v2-card max-w-md w-full p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary text-2xl">
          🚀
        </div>
        <h1 className="text-2xl font-bold text-text">bal24 WorkFlow v2</h1>
        <p className="text-sm text-muted">
          STEP 1 — 프로젝트 초기 설정 완료<br />
          다음 단계: Skywork 검토 후 STEP 2 (Supabase 테이블)
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <span className="badge-active">진행</span>
          <span className="badge-billing">정산</span>
          <span className="badge-closed">종료</span>
          <span className="badge-proposal">제안</span>
        </div>
      </div>
    </div>
  );
}
