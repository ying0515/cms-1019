# Inline cell edit (list tables)

Reference implementation: `features/courses/course-list` (spec `spec/course/Course.md` › List — Inline Edit).

PrimeNG's `pEditableColumn` / `p-cellEditor` opens on a single click, so we use our own
double-click editor on a plain `p-table`.

## Behaviour

- **Double-click** a `td[data-field="<field>"]` opens its editor; a single click does nothing.
  Cells without `data-field` (pkid, FK labels) are read-only.
- Editable cells have **no links**: the first click of a double-click would navigate. Use the
  row's 檢視 button for the detail page.
- Editor gets focus on open. **Blur** (focus leaves the cell) validates and saves; **Enter** also
  commits (text / number / date); **Escape** cancels.
- Invalid value → `<small class="cell-error">` below the editor; the cell stays open, and another
  cell can't be opened until it's fixed or cancelled.
- Valid + changed → optimistic row update, save, success toast 已更新. Failure → revert that field,
  error toast 更新失敗 with `httpErrorMessage()`. Unchanged → close, no request.

## Wiring

- Component state: `editing = signal<{ pkid, field } | null>`, `editError = signal<string | null>`,
  `editValue` (ngModel). `isEditing(item, field)` drives `[class.cell-editing]` and the `@if`.
- `<tr (dblclick)="onCellDblClick($event, item)" (focusout)="onEditorFocusOut($event)"
  (keydown.escape)="cancelEdit()">`. Focus-out ignores `relatedTarget` inside the cell.
- Overlay editors (`p-select`, `p-datepicker`, `appendTo="body"`): focus moving into the overlay is
  not a blur. Bind `(onShow)="onOverlayShow()"` and `(onHide)` / `(onClose)="onOverlayHide()"`;
  on hide, commit if focus is no longer in the cell. Both refocus their input after a pick, so the
  cell stays open with the new value until focus leaves it (same as any other editor).
- Dates: `p-datepicker dataType="string" dateFormat="yy-mm-dd"`; validate with `parseIsoDate` +
  `toIsoDate` round-trip (rejects 2026-02-30).
- Validation is a pure `validate<T>Field(field, value, row)` returning a zh-TW message or null,
  using the same messages and limits as the form.
- **Save the full record:** if PUT re-syncs n-n (delete-then-reinsert) and list rows carry empty
  n-n arrays, `GET /{id}` first and PUT that record with the edited field.
