import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ConfirmDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly collapsed = signal(false);

  protected readonly navGroups: NavGroup[] = [
    {
      key: 'home',
      label: '首頁 Home',
      icon: 'pi pi-home',
      items: [
        { label: '上稿作業 FeaturedPromoItem', icon: 'pi pi-megaphone', route: '/featured-promo-items' },
      ],
    },
    {
      key: 'admin',
      label: '系統管理 Admin',
      icon: 'pi pi-shield',
      items: [
        { label: '使用者 AppUser', icon: 'pi pi-user', route: '/app-users' },
        { label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles' },
        { label: '發布狀態 PublishStatus', icon: 'pi pi-flag', route: '/publish-statuses' },
      ],
    },
    {
      key: 'course',
      label: '課程管理 Course',
      icon: 'pi pi-book',
      items: [
        { label: '課程 Course', icon: 'pi pi-graduation-cap', route: '/courses' },
        { label: '合作廠商 Partner', icon: 'pi pi-building', route: '/partners' },
        { label: '課程群組 CourseGroup', icon: 'pi pi-tags', route: '/course-groups' },
      ],
    },
  ];

  protected readonly expanded = signal<Record<string, boolean>>({
    home: true,
    admin: true,
    course: true,
  });

  toggleGroup(key: string): void {
    this.expanded.update((s) => ({ ...s, [key]: !s[key] }));
  }

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }
}
