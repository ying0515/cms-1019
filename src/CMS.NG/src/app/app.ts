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
      key: 'admin',
      label: '系統管理 Admin',
      icon: 'pi pi-shield',
      items: [
        { label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles' },
        { label: '發布狀態 PublishStatus', icon: 'pi pi-flag', route: '/publish-statuses' },
      ],
    },
  ];

  protected readonly expanded = signal<Record<string, boolean>>({ admin: true });

  toggleGroup(key: string): void {
    this.expanded.update((s) => ({ ...s, [key]: !s[key] }));
  }

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }
}
