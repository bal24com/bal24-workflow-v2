// bal24 v2 — 파일 → 텍스트 추출 (V7 차용 + V2 표준)
// XLSX·CSV·DOCX·TXT를 AI에 보낼 수 있는 통합 텍스트로 변환.
// docx는 mammoth 패키지 필요 — dynamic import (미설치 시 친화 에러).

import * as XLSXModule from 'xlsx';

/** STEP-UX-FIXES — 'pdf'/'image' 분류 추가 (멀티모달 라우팅 명시화) */
export type FileTextSource = 'xlsx' | 'csv' | 'docx' | 'text' | 'pdf' | 'image' | 'unknown';

export interface ExtractedDoc {
  source: FileTextSource;
  fileName: string;
  text: string;
  bytes: number;
  pages?: number;
  warnings?: string[];
}

/** 파일 확장자·MIME으로 어떤 포맷인지 판별 */
export function classifyFile(file: File): FileTextSource {
  const n = file.name.toLowerCase();
  const t = (file.type || '').toLowerCase();
  if (/\.xlsx?$|\.xlsm$/.test(n) || t.includes('spreadsheet')) return 'xlsx';
  if (/\.csv$|\.tsv$/.test(n) || t === 'text/csv') return 'csv';
  if (/\.docx?$/.test(n) || t.includes('wordprocessing')) return 'docx';
  if (/\.txt$|\.md$/.test(n) || t.startsWith('text/')) return 'text';
  // STEP-UX-FIXES — PDF·이미지 명시 분류 (callAiWithFile 멀티모달 경로용)
  if (/\.pdf$/.test(n) || t === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|webp|gif)$/.test(n) || t.startsWith('image/')) return 'image';
  return 'unknown';
}

interface XlsxNamespace {
  read: (data: ArrayBuffer, opts: { type: string }) => XlsxWorkbook;
  utils: {
    sheet_to_csv: (ws: XlsxSheet, opts?: { blankrows?: boolean }) => string;
    sheet_to_json: (ws: XlsxSheet, opts: { header: 1; defval: string; blankrows: boolean }) => unknown[][];
    decode_range: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_cell: (addr: { r: number; c: number }) => string;
  };
}

interface XlsxWorkbook {
  SheetNames: string[];
  Sheets: Record<string, XlsxSheet>;
}

interface XlsxSheet {
  '!ref'?: string;
  [addr: string]: unknown;
}

/** ESM/CJS interop 양쪽 대응 */
function getXLSX(): XlsxNamespace | null {
  const mod = XLSXModule as unknown as Record<string, unknown>;
  const direct = mod as unknown as XlsxNamespace;
  if (typeof direct.read === 'function') return direct;
  const def = (mod.default as unknown) as XlsxNamespace | undefined;
  if (def && typeof def.read === 'function') return def;
  return null;
}

async function extractXlsx(file: File): Promise<ExtractedDoc> {
  const XLSX = getXLSX();
  if (!XLSX) throw new Error('xlsx 라이브러리 로드 실패');

  const buf = await file.arrayBuffer();
  let wb: XlsxWorkbook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (e) {
    const raw = e instanceof Error ? e.message : '';
    throw new Error(`엑셀 파일 읽기 실패: ${raw}`);
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('엑셀에 시트가 없어요');
  }

  const parts: string[] = [];
  let totalCells = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    parts.push(`\n## 시트: ${sheetName}\n`);

    let sheetText = '';
    // 1차 시도 — sheet_to_csv
    try {
      sheetText = XLSX.utils.sheet_to_csv(ws, { blankrows: false }) || '';
    } catch {
      // continue
    }

    // 2차 — sheet_to_json
    if (!sheetText.trim()) {
      try {
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
        sheetText = rows
          .map((r) => (r as unknown[]).map((c) => String(c ?? '').trim()).join('\t'))
          .join('\n');
      } catch {
        // continue
      }
    }

    // 3차 — 셀 단위 순회
    if (!sheetText.trim() && ws['!ref']) {
      try {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const rows: string[][] = [];
        for (let R = range.s.r; R <= range.e.r; R += 1) {
          const row: string[] = [];
          for (let C = range.s.c; C <= range.e.c; C += 1) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[addr] as { w?: string; v?: unknown } | undefined;
            const v = cell ? (cell.w ?? cell.v ?? '') : '';
            row.push(String(v).trim());
          }
          if (row.some((c) => c)) rows.push(row);
        }
        sheetText = rows.map((r) => r.join('\t')).join('\n');
      } catch {
        // noop
      }
    }

    parts.push(sheetText.trim());

    const ref = ws['!ref'];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      totalCells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    }
  }

  const finalText = parts.join('\n').trim();
  const warnings: string[] = [];
  if (!finalText || finalText.replace(/##.*\n/g, '').trim().length < 10) {
    warnings.push('⚠ 추출 텍스트가 적어요 — 이미지·차트 위주일 수 있어요. 미리보기 확인 권장.');
  }
  if (totalCells > 5000) {
    warnings.push(`⚠ 셀 약 ${totalCells.toLocaleString()}개 — 매우 큼. AI 응답이 일부일 수 있어요.`);
  }

  return {
    source: 'xlsx',
    fileName: file.name,
    text: finalText,
    bytes: file.size,
    pages: wb.SheetNames.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

async function extractCsv(file: File): Promise<ExtractedDoc> {
  const text = await file.text();
  return {
    source: 'csv',
    fileName: file.name,
    text: text.trim(),
    bytes: file.size,
  };
}

interface MammothModule {
  extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{
    value: string;
    messages?: Array<{ message: string }>;
  }>;
}

async function extractDocx(file: File): Promise<ExtractedDoc> {
  // mammoth는 선택 패키지 — 미설치 시 친화 에러
  // 동적 import 시 모듈명을 변수로 우회하여 TS 정적 해석 회피.
  const moduleName = 'mammoth';
  let mammoth: MammothModule | null = null;
  try {
    const mod = (await import(/* @vite-ignore */ moduleName)) as Record<string, unknown>;
    const direct = mod as unknown as MammothModule;
    const def = (mod.default as MammothModule | undefined);
    if (def && typeof def.extractRawText === 'function') {
      mammoth = def;
    } else if (typeof direct.extractRawText === 'function') {
      mammoth = direct;
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[file-to-text] mammoth 로드 실패:', raw);
    throw new Error('docx 처리 라이브러리(mammoth)가 설치되지 않았어요. 관리자에게 문의해 주세요.');
  }
  if (!mammoth) throw new Error('mammoth 라이브러리 로드 실패');

  const buf = await file.arrayBuffer();
  const r = await mammoth.extractRawText({ arrayBuffer: buf });
  return {
    source: 'docx',
    fileName: file.name,
    text: (r.value || '').trim(),
    bytes: file.size,
    warnings:
      r.messages && r.messages.length > 0
        ? r.messages.slice(0, 3).map((m: { message: string }) => m.message)
        : undefined,
  };
}

async function extractText(file: File): Promise<ExtractedDoc> {
  return {
    source: 'text',
    fileName: file.name,
    text: (await file.text()).trim(),
    bytes: file.size,
  };
}

// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — PDF 텍스트 추출.
// pdfjs-dist 는 선택 패키지 — 미설치 시 친화 에러로 안내.
interface PdfjsModule {
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfjsDoc> };
  GlobalWorkerOptions: { workerSrc: string };
}
interface PdfjsDoc {
  numPages: number;
  getPage: (pageNum: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  }>;
}

async function extractPdf(file: File): Promise<ExtractedDoc> {
  const moduleName = 'pdfjs-dist';
  let pdfjs: PdfjsModule | null = null;
  try {
    const mod = (await import(/* @vite-ignore */ moduleName)) as Record<string, unknown>;
    const direct = mod as unknown as PdfjsModule;
    const def = mod.default as PdfjsModule | undefined;
    if (def && typeof def.getDocument === 'function') {
      pdfjs = def;
    } else if (typeof direct.getDocument === 'function') {
      pdfjs = direct;
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[file-to-text] pdfjs-dist 로드 실패:', raw);
    throw new Error('PDF 처리 라이브러리(pdfjs-dist)가 설치되지 않았어요. 관리자에게 문의해 주세요.');
  }
  if (!pdfjs) throw new Error('pdfjs-dist 라이브러리 로드 실패');

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(pdf.numPages, 30);
  const pages: string[] = [];
  for (let i = 1; i <= maxPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    pages.push(text.trim());
  }
  return {
    source: 'pdf',
    fileName: file.name,
    text: pages.filter((p) => p).join('\n\n').trim(),
    bytes: file.size,
    pages: pdf.numPages,
    warnings:
      pdf.numPages > maxPages
        ? [`⚠ ${pdf.numPages}쪽 중 처음 ${maxPages}쪽만 분석했어요.`]
        : undefined,
  };
}

/** 파일 → 텍스트 (포맷 자동 판별, 실패 시 null) */
export async function fileToText(file: File): Promise<ExtractedDoc | null> {
  const kind = classifyFile(file);
  try {
    switch (kind) {
      case 'xlsx':
        return await extractXlsx(file);
      case 'csv':
        return await extractCsv(file);
      case 'docx':
        return await extractDocx(file);
      case 'text':
        return await extractText(file);
      case 'pdf':
        return await extractPdf(file);
      default:
        return null;
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error(`[file-to-text] '${file.name}' (${kind}) 추출 실패:`, raw);
    return null;
  }
}

/** 여러 파일 추출 결과를 AI 프롬프트용 라벨링 텍스트로 변환 */
export function formatExtractedForPrompt(docs: ExtractedDoc[]): string {
  if (docs.length === 0) return '';
  return docs
    .map((d) => {
      const sizeKb = (d.bytes / 1024).toFixed(1);
      const head = `[첨부: ${d.fileName} (${d.source.toUpperCase()}${
        d.pages ? `, ${d.pages}개 시트/페이지` : ''
      }, ${sizeKb}KB)]`;
      return `${head}\n${d.text}`;
    })
    .join('\n\n---\n\n');
}
