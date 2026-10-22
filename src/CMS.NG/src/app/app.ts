import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '@core/services/auth.service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Shown only to the Admin role (the API answers 403 to others) */
  adminOnly?: boolean;
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Starts collapsed on phones (same 768px breakpoint as app.scss) so content gets the width. */
  protected readonly collapsed = signal(window.matchMedia('(max-width: 768px)').matches);
  protected readonly user = this.auth.user;
  /** Sidebar only for a usable session: login and the forced password change render alone. */
  protected readonly showShell = computed(() => {
    const user = this.user();
    return !!user && !user.mustChangePassword;
  });

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
        { label: '使用者 AppUser', icon: 'pi pi-user', route: '/app-users', adminOnly: true },
        { label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles', adminOnly: true },
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

  /** navGroups without admin-only items for non-admins (a group left empty is dropped). */
  protected readonly visibleNavGroups = computed(() => {
    const isAdmin = !!this.user()?.isAdmin;
    return this.navGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) }))
      .filter((g) => g.items.length > 0);
  });

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

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
