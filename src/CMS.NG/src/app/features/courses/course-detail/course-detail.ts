import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';

import { Course } from '@core/models/course.model';
import { CertificationLookup } from '@core/models/lookup.model';
import { CourseService } from '@core/services/course.service';
import { httpErrorMessage } from '@core/utils/http-error.util';
import { CourseQrCode } from '../course-qr-code/course-qr-code';

@Component({
  selector: 'app-course-detail',
  imports: [DecimalPipe, RouterLink, ButtonModule, ChipModule, CourseQrCode],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CourseService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly item = signal<Course | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  /** Long text fields shown in the 課程內容 panel, in display order. */
  readonly contentFields: { key: keyof Course; label: string }[] = [
    { key: 'material', label: '教材' },
    { key: 'objective', label: '課程目標' },
    { key: 'target', label: '適合對象' },
    { key: 'prerequisites', label: '先備知識' },
    { key: 'outline', label: '課程大綱' },
    { key: 'towardCertOrExam', label: '考試／認證說明' },
    { key: 'note', label: '備註' },
    { key: 'otherInfo', label: '其他資訊' },
  ];

  ngOnInit(): void {
    // pkid is int IDENTITY
    const id = this.route.snapshot.paramMap.get('id');
    const pkid = id === null || id.trim() === '' ? NaN : Number(id);
    if (!Number.isInteger(pkid) || pkid < 1 || pkid > 2147483647) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }

    this.service.getById(pkid).subscribe({
      next: (data) => {
        this.item.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(true);
        if (err?.status !== 404) {
          this.messages.add({
            severity: 'error',
            summary: '載入失敗',
            detail: httpErrorMessage(err),
          });
        }
      },
    });
  }

  certificationLabel(c: CertificationLookup): string {
    return `${c.partnerName} - ${c.title ?? ''}`;
  }

  text(c: Course, key: keyof Course): string | null {
    return (c[key] as string | null) ?? null;
  }

  back(): void {
    this.router.navigate(['/courses']);
  }

  edit(): void {
    const item = this.item();
    if (item) this.router.navigate(['/courses', item.pkid, 'edit']);
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${item.title.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: item.title });
            this.back();
          },
          error: (err) =>
            this.messages.add({
              severity: 'error',
              summary: '刪除失敗',
              detail: httpErrorMessage(err),
            }),
        }),
    });
  }
}
