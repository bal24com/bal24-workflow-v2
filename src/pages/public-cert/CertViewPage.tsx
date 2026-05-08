// bal24 v2 — 수료증·강의확인서 외부 조회 페이지 (/cert/:token)
// 인증 X · 모바일 반응형. 토큰으로 issued_certificates 조회 → 미리보기 + PDF 다운로드.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, Download, ShieldAlert, Award, GraduationCap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import {
  elementToPdfBlob, downloadBlob, formatIssueDateKo,
} from '../../lib/certificatePdf';
import type {
  IssuedCertificate, CertificateTemplate, Program, CertificateType,
} from '../../types/database';

interface BundleData {
  cert: IssuedCertificate;
  template: CertificateTemplate | null;
  program: Pick<Program, 'id' | 'name' | 'start_date' | 'end_date'> | null;
}

const CERT_TYPE_LABEL: Record<CertificateType, string> = {
  completion: '수료증',
  lecture: '강의확인서',
};

export default function CertViewPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [state, setState] = useState<'loading' | 'notfound' | 'ok'>('loading');
  const [bundle, setBundle] = useState<BundleData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) {
      setState('notfound');
      return;
    }
    let cancelled = false;
    setState('loading');
    void (async () => {
      const certRes = await supabase
        .from('issued_certificates')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (cancelled) return;
      if (certRes.error || !certRes.data) {
        if (certRes.error) console.error('[public-cert] 조회 실패:', certRes.error.message);
        setState('notfound');
        return;
      }
      const cert = certRes.data as IssuedCertificate;

      const [tplRes, progRes] = await Promise.all([
        supabase
          .from('certificate_templates')
          .select('*')
          .eq('id', cert.template_id)
          .maybeSingle(),
        supabase
          .from('programs')
          .select('id, name, start_date, end_date')
          .eq('id', cert.program_id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (tplRes.error) console.error('[public-cert] 템플릿 실패:', tplRes.error.message);
      if (progRes.error) console.error('[public-cert] 프로그램 실패:', progRes.error.message);

      setBundle({
        cert,
        template: (tplRes.data as CertificateTemplate | null) ?? null,
        program: (progRes.data as BundleData['program']) ?? null,
      });
      setState('ok');
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleDownload() {
    if (!printRef.current || !bundle) return;
    setDownloading(true);
    try {
      const blob = await elementToPdfBlob(printRef.current);
      if (!blob) {
        toast.error('PDF 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const filename = `${CERT_TYPE_LABEL[bundle.cert.cert_type]}_${bundle.cert.recipient_name}.pdf`;
      downloadBlob(blob, filename);
      toast.success('PDF를 다운로드했어요.');
    } finally {
      setDownloading(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-violet-100 bg-white p-8 flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
          <p className="text-sm text-slate-500">불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (state === 'notfound' || !bundle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-8 max-w-md w-full flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="text-rose-400" size={32} aria-hidden="true" />
          <p className="text-base font-bold text-[#1E1B4B]">수료증을 찾을 수 없어요</p>
          <p className="text-sm text-slate-500 leading-relaxed">
            이 링크는 만료됐거나 잘못된 링크일 수 있어요. 담당자에게 문의해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const { cert, template, program } = bundle;
  const isCompletion = cert.cert_type === 'completion';
  const Icon = isCompletion ? Award : GraduationCap;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-md sm:max-w-2xl flex flex-col gap-4">
        <header className="rounded-2xl border border-violet-100 bg-white p-5 flex items-center gap-3 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-600">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {CERT_TYPE_LABEL[cert.cert_type]}
            </p>
            <h1 className="text-base sm:text-lg font-bold text-[#1E1B4B] truncate">
              {cert.recipient_name}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Download size={12} aria-hidden="true" />}
            <span className="hidden sm:inline">PDF</span>
            <span className="sm:hidden">받기</span>
          </button>
        </header>

        {/* 미리보기 + 인쇄 영역 */}
        <div
          ref={printRef}
          className="rounded-2xl border border-slate-300 bg-white p-8 sm:p-12 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col items-center gap-6 min-h-[480px]"
        >
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
              {template?.institution_name || '발급기관'}
            </p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-[#1E1B4B] tracking-wide">
              {template?.title || CERT_TYPE_LABEL[cert.cert_type]}
            </h2>
            <div className="mt-2 mx-auto w-16 h-0.5 bg-violet-300" aria-hidden="true" />
          </div>

          {cert.cert_number && (
            <p className="text-[11px] text-slate-500 tabular-nums">
              제 {cert.cert_number} 호
            </p>
          )}

          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-slate-500">성명</p>
            <p className="text-xl sm:text-2xl font-bold text-[#1E1B4B]">{cert.recipient_name}</p>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed text-center max-w-md">
            위 사람은 <b className="text-violet-700">{program?.name ?? '프로그램'}</b>
            {' '}에 {isCompletion ? '성실히 참여하여 수료하였음' : '강사로 참여하였음'}을 확인합니다.
          </p>

          <div className="flex flex-col items-center gap-1 pt-4">
            <p className="text-sm text-[#1E1B4B] font-semibold">
              {formatIssueDateKo(cert.issue_date)}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <p className="text-base font-bold text-[#1E1B4B]">
                {template?.institution_name || '발급기관'}
              </p>
              {template?.seal_file_url && (
                <img
                  src={template.seal_file_url}
                  alt="직인"
                  crossOrigin="anonymous"
                  className="w-16 h-16 object-contain"
                />
              )}
            </div>
            {template?.signature_name && (
              <p className="mt-1 text-[11px] text-slate-500">{template.signature_name}</p>
            )}
          </div>
        </div>

        <footer className="text-center pt-2 pb-1">
          <p className="text-[10px] text-slate-400">© 2026 BalanceDot WorkFlow · 외부 조회 페이지</p>
        </footer>
      </div>
    </div>
  );
}
