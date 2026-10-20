import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import QRCode from 'qrcode';

/** Public course page that the QR code points to. */
export function courseQrUrl(pkid: number, courseId: string): string {
  return `https://www.uuu.com.tw/Course/Show/${pkid}/${encodeURIComponent(courseId.trim())}`;
}

const MODULE_PX = 6;
const QUIET_MODULES = 4;
const TITLE_BAND_PX = 44;
const TITLE_MAX_FONT_PX = 22;

/** QR code for a course's public page, with CourseId drawn above it; downloadable as PNG. */
@Component({
  selector: 'app-course-qr-code',
  imports: [ButtonModule],
  templateUrl: './course-qr-code.html',
  styleUrl: './course-qr-code.scss',
})
export class CourseQrCode {
  readonly pkid = input.required<number>();
  readonly courseId = input.required<string>();

  readonly title = computed(() => this.courseId().trim());
  readonly url = computed(() => courseQrUrl(this.pkid(), this.courseId()));
  readonly qr = computed(() => QRCode.create(this.url(), { errorCorrectionLevel: 'M' }));
  readonly fileName = computed(
    () => `${this.title().replace(/[\\/:*?"<>|\s]+/g, '_') || this.pkid()}-QRCode.png`,
  );

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterRenderEffect(() => this.draw(this.canvas().nativeElement));
  }

  /** Saves the rendered canvas (title + QR) as a PNG file. */
  download(): Promise<void> {
    const canvas = this.canvas().nativeElement;
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('QR code image could not be generated'));
          return;
        }
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = this.fileName();
        a.click();
        URL.revokeObjectURL(href);
        resolve();
      }, 'image/png'),
    );
  }

  private draw(canvas: HTMLCanvasElement): void {
    const { size, data } = this.qr().modules;
    const qrPx = (size + QUIET_MODULES * 2) * MODULE_PX;
    canvas.width = qrPx;
    canvas.height = qrPx + TITLE_BAND_PX;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title, shrunk to fit the width.
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontPx = TITLE_MAX_FONT_PX;
    do {
      ctx.font = `bold ${fontPx}px sans-serif`;
    } while (ctx.measureText(this.title()).width > qrPx - 16 && --fontPx > 8);
    ctx.fillText(this.title(), qrPx / 2, TITLE_BAND_PX / 2 + 4);

    const offset = QUIET_MODULES * MODULE_PX;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (data[row * size + col]) {
          ctx.fillRect(
            offset + col * MODULE_PX,
            TITLE_BAND_PX + offset + row * MODULE_PX,
            MODULE_PX,
            MODULE_PX,
          );
        }
      }
    }
  }
}
