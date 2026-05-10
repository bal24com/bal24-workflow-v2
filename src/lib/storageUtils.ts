// bal24 v2 — STEP-STORAGE-BUCKET-SETUP
// 표준 6 버킷 + 경로 패턴 + 공통 업로드/삭제 헬퍼.

import { supabase } from './supabase';

// ============================================================
// Storage 버킷 상수
// ============================================================
export const STORAGE_BUCKETS = {
  PROJECT_FILES:      'project-files',
  GRANT_DOCUMENTS:    'grant-documents',
  REPORT_ATTACHMENTS: 'report-attachments',
  ACTIVITY_LOGS:      'activity-logs',
  AUDIT_REPORTS:      'audit-reports',
  AVATARS:            'avatars',
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

// 파일 경로 패턴 상수
export const STORAGE_PATHS = {
  // project-files
  projectFile: (projectId: string, fileName: string) =>
    `${projectId}/${fileName}`,

  // grant-documents: 지출 증빙서류
  grantDocument: (
    projectId: string,
    expenditureId: string,
    docType: 'biz_reg' | 'bank_copy' | 'inspection' | 'contract' | 'quote',
    ext: string,
  ) => `${projectId}/${expenditureId}/${docType}.${ext}`,

  // report-attachments: 사업실적보고서 첨부
  reportAttachment: (
    reportId: string,
    section: string,
    fileName: string,
  ) => `${reportId}/${section}/${fileName}`,

  // activity-logs: 멘토링 사진
  activityLog: (logId: string, fileName: string) =>
    `${logId}/${fileName}`,

  // audit-reports: 감사 리포트
  auditReport: (projectId: string, fileName: string) =>
    `${projectId}/${fileName}`,

  // avatars
  avatar: (userId: string, ext: string) => `${userId}/avatar.${ext}`,
} as const;

// ============================================================
// 파일 업로드 공통 함수
// ============================================================
export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Storage 에 파일을 업로드하고 공개 URL 을 반환한다.
 * 업로드 실패 시 Error 를 throw 한다.
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File,
  upsert = true,
): Promise<UploadResult> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error(`[storage] 업로드 실패 (${bucket}/${path}):`, uploadError.message);
    const m = uploadError.message.toLowerCase();
    if (m.includes('bucket not found')) {
      throw new Error(`파일 저장소(${bucket})가 없어요. 관리자에게 문의해 주세요.`);
    }
    if (m.includes('mime type') || m.includes('not allowed')) {
      throw new Error('지원하지 않는 파일 형식이에요.');
    }
    if (m.includes('payload too large') || m.includes('exceeded')) {
      throw new Error('파일 크기가 너무 커요.');
    }
    if (m.includes('row-level security')) {
      throw new Error('파일 업로드 권한이 없어요.');
    }
    throw new Error('파일 업로드에 실패했어요. 다시 시도해 주세요.');
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
  };
}

/**
 * Storage 에서 파일을 삭제한다.
 * 삭제 실패 시 Error 를 throw 한다.
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error(`[storage] 삭제 실패 (${bucket}/${path}):`, error.message);
    throw new Error('파일 삭제에 실패했어요.');
  }
}

/**
 * 비공개 버킷의 임시 다운로드 URL 생성 (기본 1시간).
 */
export async function createSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    console.error(`[storage] signed URL 실패 (${bucket}/${path}):`, error?.message);
    throw new Error('파일 열기 권한이 없어요.');
  }
  return data.signedUrl;
}

// ============================================================
// 헬퍼
// ============================================================

/** 파일 확장자 추출 (없으면 'bin'). */
export function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? (parts.pop() ?? 'bin') : 'bin';
}

/** 파일 크기를 읽기 좋은 형식으로 (예: 1048576 → "1.0 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** 이미지 파일 여부. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** 허용 MIME 타입인지 확인. */
export function isAllowedMimeType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/** 안전한 파일 경로용 베이스 이름 (한글·영숫자·점·하이픈만). */
export function safeFileBase(name: string, maxLength = 60): string {
  const noExt = name.replace(/\.[^.]+$/, '');
  return noExt.replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, maxLength);
}
