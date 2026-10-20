import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RowAuditEntry } from '../models/row-audit.model';
import { RowAuditService } from '../services/row-audit.service';

/** Stubs the history API behind `<app-row-audit-badge>`, which every detail / edit page renders. */
export function provideRowAuditStub(history: RowAuditEntry[] = []) {
  const stub = jasmine.createSpyObj<RowAuditService>('RowAuditService', ['getHistory']);
  stub.getHistory.and.returnValue(of(history));
  return { provide: RowAuditService, useValue: stub };
}

/** The stub from `provideRowAuditStub()`, to check which record a page's badge asked for. */
export function rowAuditStub(): jasmine.SpyObj<RowAuditService> {
  return TestBed.inject(RowAuditService) as jasmine.SpyObj<RowAuditService>;
}
