import { FormControl, FormGroup } from '@angular/forms';
import {
  isStrongPassword,
  passwordPolicyValidator,
  passwordsMatchValidator,
} from './password-policy';

describe('password policy', () => {
  // Same cases as CMS.API PasswordPolicyTests / AuthChangePasswordTests
  const cases: [string, boolean][] = [
    ['Abcdefg1', true], // upper + lower + digit
    ['abcdef1!', true], // lower + digit + symbol
    ['ABCDEF1!', true], // upper + digit + symbol
    ['Abcdefg!', true], // upper + lower + symbol
    ['Ab1!Ab1!', true], // all 4
    ['密碼abc123', true], // 8 chars: lower + digit + CJK (counts as a symbol)
    ['Ab1!xyz', false], // 7 chars
    ['abcdefgh', false], // 1 class
    ['abcd1234', false], // 2 classes
    ['ABCDabcd', false], // 2 classes
    ['abcd!@#$', false], // 2 classes
    ['abc  123', false], // whitespace is not a symbol
    ['', false],
  ];

  for (const [password, expected] of cases) {
    it(`isStrongPassword(${JSON.stringify(password)}) is ${expected}`, () => {
      expect(isStrongPassword(password)).toBe(expected);
    });
  }

  it('passwordPolicyValidator leaves empty values to required', () => {
    expect(passwordPolicyValidator(new FormControl(''))).toBeNull();
    expect(passwordPolicyValidator(new FormControl('weak'))).toEqual({ passwordPolicy: true });
    expect(passwordPolicyValidator(new FormControl('Abcdefg1'))).toBeNull();
  });

  it('passwordsMatchValidator flags only filled, different values', () => {
    const group = (a: string, b: string) =>
      new FormGroup(
        { next: new FormControl(a), confirm: new FormControl(b) },
        { validators: passwordsMatchValidator('next', 'confirm') },
      );

    expect(group('Abcdefg1', 'Abcdefg2').errors).toEqual({ passwordMismatch: true });
    expect(group('Abcdefg1', 'Abcdefg1').errors).toBeNull();
    expect(group('Abcdefg1', '').errors).toBeNull();
  });
});
