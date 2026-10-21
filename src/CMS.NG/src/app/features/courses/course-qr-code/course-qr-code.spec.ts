import { ComponentFixture, TestBed } from '@angular/core/testing';
import QRCode from 'qrcode';

import { CourseQrCode, courseQrUrl } from './course-qr-code';

describe('CourseQrCode', () => {
  const EXPECTED_URL = 'https://www.uuu.com.tw/Course/Show/1/AZ-104';

  async function create(pkid: number, courseId: string) {
    await TestBed.configureTestingModule({ imports: [CourseQrCode] }).compileComponents();
    const fixture = TestBed.createComponent(CourseQrCode);
    fixture.componentRef.setInput('pkid', pkid);
    fixture.componentRef.setInput('courseId', courseId);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function canvasOf(fixture: ComponentFixture<CourseQrCode>): HTMLCanvasElement {
    return fixture.nativeElement.querySelector('canvas');
  }

  it('courseQrUrl() builds the public course URL from pkid and trimmed CourseId', () => {
    expect(courseQrUrl(1, 'AZ-104')).toBe(EXPECTED_URL);
    expect(courseQrUrl(1, 'AZ-104   ')).toBe(EXPECTED_URL);
    expect(courseQrUrl(7, 'C#/.NET 101')).toBe(
      'https://www.uuu.com.tw/Course/Show/7/C%23%2F.NET%20101',
    );
  });

  it('encodes the expected URL from the record pkid/CourseId', async () => {
    const fixture = await create(1, 'AZ-104');
    const cmp = fixture.componentInstance;
    const expected = QRCode.create(EXPECTED_URL, { errorCorrectionLevel: 'M' }).modules;

    expect(cmp.url()).toBe(EXPECTED_URL);
    expect(fixture.nativeElement.querySelector('.qr-url')?.getAttribute('href')).toBe(EXPECTED_URL);
    expect(cmp.qr().modules.size).toBe(expected.size);
    expect(Array.from(cmp.qr().modules.data)).toEqual(Array.from(expected.data));

    // The canvas pixels match the expected module matrix (sample each module's centre).
    const canvas = canvasOf(fixture);
    const titleBand = canvas.height - canvas.width;
    const modulePx = canvas.width / (expected.size + 8);
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let mismatches = 0;
    for (let row = 0; row < expected.size; row++) {
      for (let col = 0; col < expected.size; col++) {
        const x = Math.floor((col + 4.5) * modulePx);
        const y = Math.floor(titleBand + (row + 4.5) * modulePx);
        const dark = pixels[(y * canvas.width + x) * 4] < 128;
        if (dark !== !!expected.data[row * expected.size + col]) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('hides the URL caption when showCaption is false', async () => {
    const fixture = await create(1, 'AZ-104');
    fixture.componentRef.setInput('showCaption', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('figcaption')).toBeNull();
    expect(canvasOf(fixture)).not.toBeNull();
  });

  it('re-encodes when the record changes', async () => {
    const fixture = await create(1, 'AZ-104');
    fixture.componentRef.setInput('pkid', 2);
    fixture.componentRef.setInput('courseId', 'CCNA');
    fixture.detectChanges();

    expect(fixture.componentInstance.url()).toBe('https://www.uuu.com.tw/Course/Show/2/CCNA');
  });

  it('shows the CourseId as the title above the QR code', async () => {
    const fillText = spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callThrough();
    const fixture = await create(1, 'AZ-104  ');
    const canvas = canvasOf(fixture);

    expect(fixture.componentInstance.title()).toBe('AZ-104');
    expect(fillText).toHaveBeenCalledWith('AZ-104', jasmine.any(Number), jasmine.any(Number));
    const [, , y] = fillText.calls.mostRecent().args;
    expect(y).toBeLessThan(canvas.height - canvas.width); // inside the title band, above the QR
    expect(canvas.getAttribute('aria-label')).toBe('QR Code：AZ-104');
  });

  it('download produces a PNG image of the rendered QR code named after the CourseId', async () => {
    const fixture = await create(1, 'AZ-104');
    let blob: Blob | undefined;
    spyOn(URL, 'createObjectURL').and.callFake((b) => {
      blob = b as Blob;
      return 'blob:qr-test';
    });
    const revoke = spyOn(URL, 'revokeObjectURL');
    let anchor: HTMLAnchorElement | undefined;
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      anchor = this;
    });

    await fixture.componentInstance.download();

    expect(anchor?.download).toBe('AZ-104-QRCode.png');
    expect(anchor?.href).toBe('blob:qr-test');
    expect(revoke).toHaveBeenCalledWith('blob:qr-test');
    expect(blob?.type).toBe('image/png');
    const signature = new Uint8Array(await blob!.slice(0, 8).arrayBuffer());
    expect(Array.from(signature)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const image = await createImageBitmap(blob!);
    const canvas = canvasOf(fixture);
    expect(image.width).toBe(canvas.width);
    expect(image.height).toBe(canvas.height);
  });

  it('sanitises characters that are invalid in file names', async () => {
    const fixture = await create(7, 'C#/.NET 101');
    expect(fixture.componentInstance.fileName()).toBe('C#_.NET_101-QRCode.png');
  });

  it('the 下載 QR Code button triggers the download', async () => {
    const fixture = await create(1, 'AZ-104');
    const download = spyOn(fixture.componentInstance, 'download').and.resolveTo();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('p-button button');

    expect(button.textContent).toContain('下載 QR Code');
    button.click();

    expect(download).toHaveBeenCalled();
  });
});
