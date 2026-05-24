// bal24 v2 — STEP-EXPERT-CRUD-FULL soft-delete 공용 유틸
// clients / staff_pool 30일 휴지통 정책: deleted_at IS NOT NULL = 삭제 보관 상태

import { supabase } from './supabase';

// STEP-DELETE-RESUME-FULL — projects/consortiums 추가
export type SoftDeleteTable = 'clients' | 'staff_pool' | 'projects' | 'consortiums';

/** 삭제 (deleted_at = now) — 휴지통으로 이동 */
export async function softDelete(table: SoftDeleteTable, id: string): Promise<string | null> {
  const { error } = await supabase.from(table)
    .update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    console.error(`[softDelete:${table}]`, error.message);
    return '삭제 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  }
  return null;
}

/** 복원 (deleted_at = null) */
export async function restoreRecord(table: SoftDeleteTable, id: string): Promise<string | null> {
  const { error } = await supabase.from(table)
    .update({ deleted_at: null }).eq('id', id);
  if (error) {
    console.error(`[restoreRecord:${table}]`, error.message);
    return '복원 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  }
  return null;
}

/** 영구 삭제 (실제 DELETE — 30일 경과 row 또는 관리자 강제) */
export async function permanentDelete(table: SoftDeleteTable, id: string): Promise<string | null> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    // PostgrestError 안전 추출 — error.code·details 까지 사용해서 진짜 원인 표시
    const code = (error as { code?: string }).code ?? '';
    const details = (error as { details?: string }).details ?? '';
    const msg = error.message ?? '';
    console.error(`[permanentDelete:${table}]`, { code, message: msg, details });

    const m = `${msg} ${code} ${details}`.toLowerCase();
    if (m.includes('foreign key') || m.includes('violates') || m.includes('23503')) {
      const refMatch = details.match(/table\s+"([^"]+)"/i);
      const child = refMatch ? ` (자식 테이블: ${refMatch[1]})` : '';
      return `연관된 자식 데이터${child}가 남아 있어서 영구 삭제할 수 없어요.\n→ 자식 데이터를 먼저 정리한 뒤 다시 시도해 주세요.`;
    }
    if (m.includes('row-level security') || m.includes('permission denied')) {
      return '삭제 권한이 없어요. 관리자에게 문의해 주세요.';
    }
    return msg ? `영구 삭제 실패: ${msg}` : '영구 삭제 중 오류가 발생했어요.';
  }
  return null;
}

/** deletedAt(ISO) → 30일 카운트다운 (0 이하 = 만료, 즉시 영구삭제 대상) */
export function daysLeft(deletedAt: string): number {
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
  return Math.max(0, 30 - elapsed);
}
