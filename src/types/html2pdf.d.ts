// bal24 v2 — STEP-MENTORING-P2-PDF
// html2pdf.js 타입 선언 (라이브러리 자체 타입 미제공).

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
  }
  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(element: HTMLElement | string): Html2PdfInstance;
    save(): Promise<void>;
    output(type: string): Promise<Blob>;
  }
  function html2pdf(): Html2PdfInstance;
  export default html2pdf;
}
