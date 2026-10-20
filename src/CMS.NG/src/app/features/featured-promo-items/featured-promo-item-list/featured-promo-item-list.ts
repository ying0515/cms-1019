import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';

import { FeaturedPromoItem, MAX_SLOT } from '@core/models/featured-promo-item.model';
import { PromotionLookup, TrainingCenterLookup } from '@core/models/lookup.model';
import { FeaturedPromoItemService } from '@core/services/featured-promo-item.service';
import { LookupService } from '@core/services/lookup.service';
import { addDays, parseIsoDate, startOfWeek, toIsoDate } from '@core/utils/date.util';
import { showHttpError } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';
import {
  FeaturedPromoItemDraft,
  FeaturedPromoItemForm,
} from '../featured-promo-item-form/featured-promo-item-form';

export const FILTERS_KEY = 'featured-promo-item-list-filters';

export interface FeaturedPromoItemListFilters {
  trainingCenterPkid: number | null;
  /** Monday of the shown week, 'yyyy-MM-dd'. */
  weekOf: string | null;
}

export interface SlotRow {
  slot: number;
  item: FeaturedPromoItem | null;
}

export interface ScheduleDay {
  /** 'yyyy-MM-dd' */
  date: string;
  /** e.g. '3/16 (一)' */
  label: string;
  rows: SlotRow[];
}

/** Values kept by 複製 and filled in by 貼上. */
export interface CopiedItem {
  promotion: PromotionLookup;
  topic: string;
  description: string;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const SLOTS = Array.from({ length: MAX_SLOT }, (_, i) => i + 1);

/** Weekly schedule: one tab per TrainingCenter, Monday–Sunday, slots 1–3 per day, inline editing. */
@Component({
  selector: 'app-featured-promo-item-list',
  imports: [ButtonModule, TabsModule, TooltipModule, FeaturedPromoItemForm],
  templateUrl: './featured-promo-item-list.html',
  styleUrl: './featured-promo-item-list.scss',
})
export class FeaturedPromoItemList implements OnInit {
  private readonly service = inject(FeaturedPromoItemService);
  private readonly lookups = inject(LookupService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly maxSlot = MAX_SLOT;
  readonly trainingCenters = signal<TrainingCenterLookup[]>([]);
  readonly trainingCenterPkid = signal<number | null>(null);
  readonly weekStart = signal(startOfWeek(new Date()));
  readonly items = signal<FeaturedPromoItem[]>([]);
  readonly loading = signal(false);
  /** The row whose inline form is open (one at a time). */
  readonly draft = signal<FeaturedPromoItemDraft | null>(null);
  readonly copied = signal<CopiedItem | null>(null);

  readonly weekLabel = computed(() => {
    const start = this.weekStart();
    return `${monthDay(start)} – ${monthDay(addDays(start, 6))}`;
  });

  readonly days = computed<ScheduleDay[]>(() => {
    const byKey = new Map(this.items().map((i) => [`${i.scheduleOn}#${i.slot}`, i]));
    return Array.from({ length: 7 }, (_, n) => {
      const d = addDays(this.weekStart(), n);
      const date = toIsoDate(d);
      return {
        date,
        label: `${monthDay(d)} (${WEEKDAYS[d.getDay()]})`,
        rows: SLOTS.map((slot) => ({ slot, item: byKey.get(`${date}#${slot}`) ?? null })),
      };
    });
  });

  ngOnInit(): void {
    const saved = loadSession<FeaturedPromoItemListFilters>(FILTERS_KEY);
    const savedWeek = parseIsoDate(saved?.weekOf);
    if (savedWeek) this.weekStart.set(startOfWeek(savedWeek));

    this.lookups.getTrainingCenters().subscribe({
      next: (centers) => {
        this.trainingCenters.set(centers);
        const keep = centers.some((c) => c.pkid === saved?.trainingCenterPkid);
        this.trainingCenterPkid.set(keep ? saved!.trainingCenterPkid : (centers[0]?.pkid ?? null));
        this.load();
      },
      error: (err) =>
        showHttpError(this.messages, '載入失敗', err),
    });
  }

  selectTrainingCenter(value: string | number | undefined): void {
    const pkid = Number(value);
    if (!Number.isInteger(pkid) || pkid === this.trainingCenterPkid()) return;
    this.trainingCenterPkid.set(pkid);
    this.load();
  }

  previousWeek(): void {
    this.weekStart.update((d) => addDays(d, -7));
    this.load();
  }

  nextWeek(): void {
    this.weekStart.update((d) => addDays(d, 7));
    this.load();
  }

  thisWeek(): void {
    this.weekStart.set(startOfWeek(new Date()));
    this.load();
  }

  load(): void {
    const trainingCenterPkid = this.trainingCenterPkid();
    if (trainingCenterPkid === null) return;
    const weekOf = toIsoDate(this.weekStart());
    saveSession(FILTERS_KEY, { trainingCenterPkid, weekOf } satisfies FeaturedPromoItemListFilters);

    this.draft.set(null);
    this.loading.set(true);
    this.service.query({ trainingCenterPkid, weekOf }).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showHttpError(this.messages, '查詢失敗', err);
      },
    });
  }

  isEditing(day: ScheduleDay, row: SlotRow): boolean {
    const d = this.draft();
    return d !== null && d.scheduleOn === day.date && d.slot === row.slot;
  }

  /** 編輯: an existing row with its values, or an empty slot with blank values. */
  edit(day: ScheduleDay, row: SlotRow): void {
    const item = row.item;
    this.openForm(day, row, {
      pkid: item?.pkid ?? 0,
      promotion: item?.promotion ?? null,
      topic: item?.topic ?? '',
      description: item?.description ?? '',
    });
  }

  /** 貼上: an empty slot prefilled with the copied values. */
  paste(day: ScheduleDay, row: SlotRow): void {
    const c = this.copied();
    if (!c) return;
    this.openForm(day, row, { pkid: 0, ...c });
  }

  private openForm(
    day: ScheduleDay,
    row: SlotRow,
    values: Pick<FeaturedPromoItemDraft, 'pkid' | 'promotion' | 'topic' | 'description'>,
  ): void {
    this.draft.set({
      ...values,
      scheduleOn: day.date,
      trainingCenterPkid: this.trainingCenterPkid()!,
      slot: row.slot,
    });
  }

  closeForm(): void {
    this.draft.set(null);
  }

  copy(item: FeaturedPromoItem): void {
    if (!item.promotion) return;
    this.copied.set({
      promotion: item.promotion,
      topic: item.topic,
      description: item.description,
    });
    this.messages.add({
      severity: 'info',
      summary: '已複製',
      detail: `${item.promotion.promoCode}，請在空白位置按「貼上」`,
    });
  }

  /** "+" is possible when this or the next slot has an item to swap. */
  canMoveDown(day: ScheduleDay, row: SlotRow): boolean {
    return row.slot < MAX_SLOT && (row.item !== null || day.rows[row.slot].item !== null);
  }

  /** "−" is possible when this or the previous slot has an item to swap. */
  canMoveUp(day: ScheduleDay, row: SlotRow): boolean {
    return row.slot > 1 && (row.item !== null || day.rows[row.slot - 2].item !== null);
  }

  /** "+": Slot n → n+1. An empty slot moves by pulling the next item up instead. */
  moveDown(day: ScheduleDay, row: SlotRow): void {
    if (!this.canMoveDown(day, row)) return;
    const next = day.rows[row.slot].item;
    this.move(row.item ? this.service.moveDown(row.item.pkid) : this.service.moveUp(next!.pkid));
  }

  /** "−": Slot n → n−1. An empty slot moves by pushing the previous item down instead. */
  moveUp(day: ScheduleDay, row: SlotRow): void {
    if (!this.canMoveUp(day, row)) return;
    const previous = day.rows[row.slot - 2].item;
    this.move(
      row.item ? this.service.moveUp(row.item.pkid) : this.service.moveDown(previous!.pkid),
    );
  }

  private move(op$: Observable<void>): void {
    op$.subscribe({
      next: () => this.load(),
      error: (err) =>
        showHttpError(this.messages, '移動失敗', err),
    });
  }

  confirmDelete(item: FeaturedPromoItem): void {
    const name = item.promotion?.promoCode ?? item.topic;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(name)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item, name),
    });
  }

  private delete(item: FeaturedPromoItem, name: string): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: name });
        this.load();
      },
      error: (err) =>
        showHttpError(this.messages, '刪除失敗', err),
    });
  }
}

function monthDay(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
