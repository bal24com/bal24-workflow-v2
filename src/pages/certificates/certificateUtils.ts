// bal24 v2 — 수료증 / 강의확인서 도메인 로직 (HTML 템플릿 + Storage + 시퀀스)
// PDF 변환 코어는 lib/certificatePdf.ts 의 htmlToPdfBlob 사용 (STEP-CERT-UNIFY).

import { supabase } from '../../lib/supabase';
import { htmlToPdfBlob } from '../../lib/certificatePdf';
import type { CertificateType } from '../../types/database';

const STORAGE_BUCKET = 'certificates';

export type CertificateData = {
  recipientName: string;
  programName: string;
  /** "2026년 5월 7일" 형태로 미리 가공한 문자열 */
  issueDate: string;
  validHours?: number | null;
  certNumber: string;
  institutionName: string;
  signatureName: string;
  sealImageUrl?: string | null;
  certType: CertificateType;
};

// ─── HTML 템플릿 ───────────────────────────────────
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCertificateHTML(data: CertificateData): string {
  const recipient = escape(data.recipientName);
  const program = escape(data.programName);
  const issueDate = escape(data.issueDate);
  const certNumber = escape(data.certNumber);
  const institution = escape(data.institutionName);
  const signature = escape(data.signatureName);
  const seal = data.sealImageUrl
    ? `<img src="${escape(data.sealImageUrl)}" style="width:80px; height:80px; object-fit:contain;" crossorigin="anonymous" />`
    : '';

  if (data.certType === 'completion') {
    const hours = data.validHours
      ? `<p>총 <strong>${data.validHours}시간</strong> 이수하였기에</p>`
      : '';
    return `
      <div style="text-align:center; border:4px double #7C3AED; height:100%; display:flex; flex-direction:column; justify-content:center; gap:32px; padding:40px; box-sizing:border-box;">
        <h1 style="font-size:52px; font-weight:700; color:#7C3AED; letter-spacing:16px; margin:0;">수 료 증</h1>
        <div style="font-size:24px; color:#1e1e1e;">
          <p style="font-size:32px; font-weight:600; border-bottom:2px solid #333; padding-bottom:8px; margin:0 0 24px 0;">${recipient} 귀하</p>
          <p style="margin:0 0 8px 0;">위 사람은 <strong>${program}</strong> 과정을</p>
          ${hours}
          <p style="margin:0;">성실히 수료하였으므로 이 증서를 드립니다.</p>
        </div>
        <p style="font-size:22px; color:#555; margin:0;">${issueDate}</p>
        <div style="margin-top:16px;">
          ${seal}
          <p style="font-size:22px; font-weight:600; margin:8px 0 0 0;">${institution}</p>
          <p style="font-size:18px; color:#555; margin:4px 0 0 0;">${signature}</p>
        </div>
        <p style="font-size:14px; color:#aaa; margin:0;">증서번호: ${certNumber}</p>
      </div>
    `;
  }

  return `
    <div style="text-align:center; border:2px solid #06B6D4; height:100%; display:flex; flex-direction:column; justify-content:center; gap:28px; padding:40px; box-sizing:border-box;">
      <h1 style="font-size:48px; font-weight:700; color:#06B6D4; letter-spacing:12px; margin:0;">강 의 확 인 서</h1>
      <div style="font-size:22px; color:#1e1e1e;">
        <p style="font-size:30px; font-weight:600; border-bottom:2px solid #333; padding-bottom:8px; margin:0 0 24px 0;">${recipient} 귀하</p>
        <p style="margin:0 0 8px 0;">위 사람은 <strong>${program}</strong> 과정에서</p>
        <p style="margin:0;">강사로서 성실히 강의하였음을 확인합니다.</p>
      </div>
      <p style="font-size:22px; color:#555; margin:0;">${issueDate}</p>
      <div style="margin-top:16px;">
        ${seal}
        <p style="font-size:22px; font-weight:600; margin:8px 0 0 0;">${institution}</p>
        <p style="font-size:18px; color:#555; margin:4px 0 0 0;">${signature}</p>
      </div>
      <p style="font-size:14px; color:#aaa; margin:0;">확인서 번호: ${certNumber}</p>
    </div>
  `;
}

// ─── PDF 생성 (얇은 래퍼) ─────────────────────────
// HTML 템플릿(buildCertificateHTML)은 도메인 책임, PDF 코어는 lib 으로 이동.
export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  return htmlToPdfBlob(buildCertificateHTML(data), { orientation: 'portrait', scale: 2 });
}

// ─── 증서번호 생성: CERT-YYYYMMDD-0001 ───────────
export function generateCertNumber(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `CERT-${y}${m}${d}-${seq.toString().padStart(4, '0')}`;
}

// ─── Storage 업로드 ────────────────────────────────
export type UploadedCert = {
  pdfUrl: string;
  storagePath: string;
};

export async function uploadCertificatePDF(
  blob: Blob,
  certNumber: string,
): Promise<UploadedCert> {
  const path = `${certNumber}_${Date.now()}.pdf`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('bucket not found')) {
      throw new Error(`파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`);
    }
    if (m.includes('row-level security') || m.includes('permission denied')) {
      throw new Error('PDF 업로드 권한이 없어요. 관리자에게 문의해 주세요.');
    }
    throw new Error('PDF 업로드 중 오류가 발생했어요.');
  }
  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { pdfUrl: pub.publicUrl, storagePath: path };
}

// ─── 직인 이미지 업로드 ────────────────────────────
export async function uploadSealImage(file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 40);
  const path = `seals/${Date.now()}_${safeBase}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('bucket not found')) throw new Error(`파일 저장소(${STORAGE_BUCKET})가 없어요.`);
    if (m.includes('row-level security')) throw new Error('직인 업로드 권한이 없어요.');
    throw new Error('직인 업로드 중 오류가 발생했어요.');
  }
  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

// ─── 증서번호용 시퀀스 (간단 카운트 기반) ──────────
// nextval RPC 대신 issued_certificates 행수 + 1000 사용 (cert_number unique 위반 시 재시도 권장)
export async function getNextCertSeq(): Promise<number> {
  const { count, error } = await supabase
    .from('issued_certificates')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('[cert] 시퀀스 조회 실패:', error.message);
    return 1000 + Math.floor(Math.random() * 9000);
  }
  return 1000 + (count ?? 0) + 1;
}

// 한국어 날짜 표기는 lib/certificatePdf 의 formatIssueDateKo (iso: string) 사용 — 중복 제거.
