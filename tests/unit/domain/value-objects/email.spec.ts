import { describe, expect, it } from 'vitest';

import { Email } from '@/domain/value-objects/email';
import { InvalidEmailError } from '@/domain/errors/invalid-email-error';

const validEmail = 'random123@gmail.com';
const unnormalizedEmail = ' RANDOM123@GMAIL.COM ';

describe('Domain Email (unit)', () => {
  it('should create an Email successfully', () => {
    const newEmail = new Email(validEmail);

    expect(newEmail.value).toBe(validEmail);
  });

  it('should normalize the email', () => {
    const email = new Email(unnormalizedEmail);

    expect(email.value).toBe(validEmail);
  });

  it('should compare emails using normalized values', () => {
    const first = new Email(unnormalizedEmail);
    const second = new Email(validEmail);

    expect(first.equals(second)).toBe(true);
  });

  it('should return false when emails are different', () => {
    const first = new Email('first@gmail.com');
    const second = new Email('second@gmail.com');

    expect(first.equals(second)).toBe(false);
  });

  it.each([
    '',
    '   ',
    'InvalidEmail',
    'user@',
    '@gmail.com',
    'user gmail@gmail.com',
    'user@gmail',
  ])('rejects the invalid email "%s"', (invalidEmail) => {
    expect(() => new Email(invalidEmail)).toThrow(InvalidEmailError);
  });
});
