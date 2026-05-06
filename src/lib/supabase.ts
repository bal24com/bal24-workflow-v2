// bal24 v2 Supabase 클라이언트
// 환경변수 (.env): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// localStorage 사용 금지 — 모든 상태는 Supabase 또는 React 상태로만 관리

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // 환경변수 누락은 개발자에게 명확히 알림 (사용자 액션 가드는 supabase 호출처에서 처리)
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] 환경변수 누락 — .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 추가 필요',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
