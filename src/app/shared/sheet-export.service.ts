import { Injectable } from '@angular/core';
import { ISheet, ISignature } from '../core/models/sheet.model';
import { buildSheetPdf, sheetFileName } from './sheet-pdf';

interface PdfMakeStatic {
  addVirtualFileSystem(vfs: unknown): void;
  createPdf(definition: Record<string, unknown>): { download(fileName: string): void; getBlob(): Promise<Blob> };
}

export interface ISheetForPdf {
  sheet: ISheet;
  pageNumber?: number | null;
  signOff?: { hod: ISignature | null; dean: ISignature | null; dvc: ISignature | null } | null;
}

/**
 * Downloads a DVC sheet as the PDF Exams & Records file (2026-11-13).
 * pdfmake loads on first use — the fonts are ~1 MB and most visits never
 * print anything. Hand-kept copy in the staff portal.
 */
@Injectable({ providedIn: 'root' })
export class SheetExportService {
  private pdfMake?: Promise<PdfMakeStatic>;
  private readonly images = new Map<string, string>();

  async download(input: ISheetForPdf): Promise<void> {
    const pdfMake = await this.load();
    pdfMake
      .createPdf(buildSheetPdf(input, (code) => this.codeImage(code)) as Record<string, unknown>)
      .download(`${sheetFileName(input.sheet, input.pageNumber)}.pdf`);
  }

  /**
   * A course code written bottom-to-top, as a PNG: pdfmake cannot rotate
   * text, and the paper stands each code on end above its units. Drawn at
   * four times the printed size so it stays crisp.
   */
  private codeImage(code: string): string {
    const cached = this.images.get(code);
    if (cached) return cached;
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = 8 * scale;
    canvas.height = 46 * scale;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height);
    context.rotate(-Math.PI / 2);
    context.fillStyle = '#000000';
    context.font = `bold ${7 * scale}px Helvetica, Arial, sans-serif`;
    context.textBaseline = 'middle';
    context.fillText(code, 2 * scale, 0, canvas.height - 4 * scale);
    const url = canvas.toDataURL('image/png');
    this.images.set(code, url);
    return url;
  }

  private load(): Promise<PdfMakeStatic> {
    this.pdfMake ??= (async () => {
      const [pdfMakeModule, vfsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ]);
      const pdfMake = ((pdfMakeModule as { default?: unknown }).default ?? pdfMakeModule) as PdfMakeStatic;
      const vfs = (vfsModule as { default?: unknown }).default ?? vfsModule;
      pdfMake.addVirtualFileSystem(vfs);
      return pdfMake;
    })();
    return this.pdfMake;
  }
}
