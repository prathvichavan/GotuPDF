// Types for PDF Worker
export interface PDFWorker {
  loadPDF(arrayBuffer: ArrayBuffer, options?: any): Promise<any>;
  extractTextFromPage(pdf: any, pageNum: number, scale?: number): Promise<any>;
  performOCR(pdf: any, pageNum: number, scale?: number): Promise<any>;
  mergeTextItems(items: any[], scale: number): Promise<any>;
}
