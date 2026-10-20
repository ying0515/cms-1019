/** Asserts the form's Save/Cancel toolbar is pinned (sticky, top 0, stacked above fields) and holds both buttons. */
export function expectPinnedToolbar(el: HTMLElement) {
  const toolbar = el.querySelector<HTMLElement>('[data-testid="form-toolbar"]')!;
  expect(toolbar).toBeTruthy();
  expect(toolbar.parentElement!.tagName).toBe('FORM');

  const style = getComputedStyle(toolbar);
  expect(style.position).toBe('sticky');
  expect(style.top).toBe('0px');
  expect(Number(style.zIndex)).toBeGreaterThan(0);

  const labels = Array.from(toolbar.querySelectorAll('button'), (b) => b.textContent!.trim());
  expect(labels).toContain('取消');
  expect(labels).toContain('儲存');
  expect(toolbar.querySelector('button[type="submit"]')).toBeTruthy();
}
