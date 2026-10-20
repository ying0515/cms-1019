import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mirrors CMS.API `Data/PasswordPolicy.cs`; the API enforces it again. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_CLASSES = 3;

export const PASSWORD_POLICY_MESSAGE_ZH =
  '密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號';
export const PASSWORD_POLICY_MESSAGE_EN =
  'Password must be at least 8 characters and contain at least 3 of the 4 classes: uppercase / lowercase / digit / symbol.';

/** Length ≥ 8 and at least 3 of: A–Z, a–z, 0–9, symbol (any other non-whitespace character). */
export function isStrongPassword(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter((re) =>
    re.test(password),
  ).length;
  return classes >= PASSWORD_MIN_CLASSES;
}

/** `{ passwordPolicy: true }` when a non-empty value fails the rule (empty is left to `required`). */
export const passwordPolicyValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null =>
  control.value && !isStrongPassword(control.value) ? { passwordPolicy: true } : null;

/** Group validator: `{ passwordMismatch: true }` when both fields are filled and differ. */
export function passwordsMatchValidator(newKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const next = group.get(newKey)?.value;
    const confirm = group.get(confirmKey)?.value;
    return next && confirm && next !== confirm ? { passwordMismatch: true } : null;
  };
}
