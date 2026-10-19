import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

import { CourseGroup } from '@core/models/course-group.model';
import { CourseGroupService } from '@core/services/course-group.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-course-group-detail',
  imports: [ButtonModule],
  templateUrl: './course-group-detail.html',
  styleUrl: './course-group-detail.scss',
})
export class CourseGroupDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CourseGroupService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly item = signal<CourseGroup | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  ngOnInit(): void {
    // pkid is smallint IDENTITY (1–32767)
    const id = this.route.snapshot.paramMap.get('id');
    const pkid = id === null || id.trim() === '' ? NaN : Number(id);
    if (!Number.isInteger(pkid) || pkid < 1 || pkid > 32767) {
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

  back(): void {
    this.router.navigate(['/course-groups']);
  }

  edit(): void {
    const item = this.item();
    if (item) this.router.navigate(['/course-groups', item.pkid, 'edit']);
  }

  viewCourses(): void {
    const item = this.item();
    if (item) this.router.navigate(['/courses'], { queryParams: { courseGroupPkid: item.pkid } });
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${item.description.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: item.description });
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
