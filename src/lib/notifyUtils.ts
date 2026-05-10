// bal24 v2 — STEP-EMAIL-NOTIFY 신청자 상태 변경 이메일 발송 (fire-and-forget)
// Edge Function `send-notification` 호출 클라이언트.

import { supabase } from './supabase';

export type NotifyType = 'applied' | 'accepted' | 'rejected' | 'returned';

export interface NotifyParams {
  type: NotifyType;
  recipientEmail: string;
  recipientName: string;
  programTitle: string;
  projectTitle?: string;
  /** 부가 메모 (legacy — review_notes 등). rejected 본문에서 reason 미입력 시 fallback 으로 사용 */
  note?: string;
  /** 탈락 사유 (rejected 전용 — STEP-REJECTION-REASON-UI). 사용자가 모달에서 직접 입력한 값. */
  reason?: string;
  /** 반려 사유 (returned 전용) */
  rejectReason?: string;
}

/**
 * 신청자에게 상태 변경 이메일을 발송한다.
 * - 이메일 주소가 없으면 조용히 skip (수신자 미입력 케이스 대응).
 * - 발송 실패해도 throw 하지 않음 — console.error 로그만 남김.
 *   메인 기능(상태 변경)이 이메일 발송 실패로 막히면 안 되기 때문.
 */
export async function sendNotification(params: NotifyParams): Promise<void> {
  const email = params.recipientEmail?.trim();
  if (!email) {
    // 수신자 이메일이 비어 있으면 발송 시도조차 하지 않음
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { ...params, recipientEmail: email },
    });
    if (error) {
      console.error('[notify] Edge Function 호출 실패:', error.message);
      return;
    }
    const result = data as { success?: boolean; error?: string } | null;
    if (result && result.success === false) {
      console.error('[notify] 발송 실패:', result.error ?? 'unknown');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    console.error('[notify] 예외:', message);
  }
}
