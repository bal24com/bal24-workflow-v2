// bal24 v2 — 결과보고서 Word(.docx) 생성 유틸 (STEP-REPORT-PDF+DOCX)
// docx 라이브러리로 섹션 기반 보고서 생성. 한글 폰트 'Malgun Gothic'.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from 'docx';

export interface ReportSectionData {
  id: string;
  section_type: string;
  title: string;
  content?: string | null;
  sort_order: number;
  is_visible?: boolean;
}

function sectionToParagraphs(section: ReportSectionData): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // 섹션 제목
  paragraphs.push(
    new Paragraph({
      text: section.title,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    }),
  );

  // 내용 (줄바꿈 처리). 빈 본문은 placeholder 텍스트.
  const content = section.content?.trim() ?? '';
  if (content.length === 0) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: '(내용 없음)', italics: true, color: '999999', size: 20 })],
        spacing: { after: 120 },
      }),
    );
  } else {
    const lines = content.split('\n');
    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 120 },
        }),
      );
    }
  }

  return paragraphs;
}

/**
 * 결과보고서 섹션 배열 → DOCX Blob 생성.
 * - 표지: 프로그램명 + 발행일 + 보라색 구분선
 * - 본문: is_visible !== false 인 섹션만, sort_order 오름차순
 */
export async function generateReportDocx(
  programName: string,
  sections: ReportSectionData[],
): Promise<Blob> {
  const visible = sections.filter((s) => s.is_visible !== false);
  const sorted = [...visible].sort((a, b) => a.sort_order - b.sort_order);

  const issueDateLabel = new Date().toLocaleDateString('ko-KR');

  const children: Paragraph[] = [
    // 문서 제목
    new Paragraph({
      children: [
        new TextRun({
          text: `${programName} 결과보고서`,
          bold: true,
          size: 36,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    // 발행일
    new Paragraph({
      children: [
        new TextRun({
          text: `발행일: ${issueDateLabel}`,
          size: 20,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 600 },
    }),
    // 구분선 (보라)
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '7C3AED', space: 1 } },
      spacing: { after: 400 },
    }),
    // 섹션 본문
    ...sorted.flatMap(sectionToParagraphs),
  ];

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Malgun Gothic', size: 22 },
        },
      },
    },
  });

  return Packer.toBlob(doc);
}
