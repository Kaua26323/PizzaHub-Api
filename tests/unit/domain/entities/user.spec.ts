import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@/domain/enums/user-role';
import { User, type UserProps } from '@/domain/entities/user';
import { InvalidUserError } from '@/domain/errors/invalid-user-error';
import { InvalidEmailError } from '@/domain/errors/invalid-email-error';

function makeUserProps(overrides: Partial<UserProps> = {}): UserProps {
  return {
    id: 'random-id',
    name: 'Kauan',
    role: 'ADMIN',
    email: 'kaua123@gmail.com',
    passwordHash: 'Super-Strong-Hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Domain User (unit)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a User successfully', () => {
    const userData = makeUserProps();
    const user = new User(userData);

    expect(user.id).toBe(userData.id);
    expect(user.name).toBe(userData.name);
    expect(user.role).toBe(userData.role);
    expect(user.email).toBe(userData.email);
    expect(user.passwordHash).toBe(userData.passwordHash);
    expect(user.createdAt).toStrictEqual(userData.createdAt);
    expect(user.updatedAt).toStrictEqual(userData.updatedAt);
  });

  it('should normalize the user name', () => {
    const user = new User(
      makeUserProps({
        name: '  Kauan  ',
      }),
    );

    expect(user.name).toBe('Kauan');
  });

  it('should change the user name', () => {
    const user = new User(makeUserProps());
    user.changeName('otherName');
    expect(user.name).toBe('otherName');
  });

  it('should normalize the name when changing it', () => {
    const user = new User(makeUserProps());

    user.changeName('  Other Name  ');

    expect(user.name).toBe('Other Name');
  });

  it('should change the user email', () => {
    const user = new User(makeUserProps());
    user.changeEmail('otheremail@gmail.com');
    expect(user.email).toBe('otheremail@gmail.com');
  });

  it('should normalize the email when changing it', () => {
    const user = new User(makeUserProps());

    user.changeEmail('  OTHEREMAIL@GMAIL.COM  ');

    expect(user.email).toBe('otheremail@gmail.com');
  });

  it('should change the user role', () => {
    const user = new User(makeUserProps());
    user.changeRole('STAFF');
    expect(user.role).toBe('STAFF');
  });

  it('should create timestamps when they are not provided', () => {
    vi.useFakeTimers();

    const now = new Date('2026-08-09T12:00:00.000Z');
    vi.setSystemTime(now);

    const user = new User({
      id: 'random-id',
      name: 'Kauan',
      role: 'ADMIN',
      email: 'kaua123@gmail.com',
      passwordHash: 'Super-Strong-Hash',
    });

    expect(user.createdAt).toStrictEqual(now);
    expect(user.updatedAt).toStrictEqual(now);
  });

  it('should update "updatedAt" when the name changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const user = new User(
      makeUserProps({ updatedAt: new Date('2026-01-01T01:00:00.000Z') }),
    );

    vi.setSystemTime(new Date('2026-01-01T02:00:00.000Z'));
    user.changeName('Other Name');

    expect(user.updatedAt).toStrictEqual(new Date('2026-01-01T02:00:00.000Z'));
  });

  it('should update "updatedAt" when the email changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const user = new User(
      makeUserProps({ updatedAt: new Date('2026-01-01T01:00:00.000Z') }),
    );

    vi.setSystemTime(new Date('2026-01-01T02:00:00.000Z'));

    user.changeEmail('otheremail@gmail.com');
    expect(user.updatedAt).toStrictEqual(new Date('2026-01-01T02:00:00.000Z'));
  });

  it('should update "updatedAt" when the role changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const user = new User(
      makeUserProps({ updatedAt: new Date('2026-01-01T01:00:00.000Z') }),
    );

    vi.setSystemTime(new Date('2026-01-01T02:00:00.000Z'));
    user.changeRole('STAFF');

    expect(user.updatedAt).toStrictEqual(new Date('2026-01-01T02:00:00.000Z'));
  });

  it('should protect createdAt from external mutation', () => {
    const user = new User(makeUserProps());

    const originalCreatedAt = user.createdAt;
    const exposedCreatedAt = user.createdAt;
    exposedCreatedAt.setFullYear(1990);

    expect(user.createdAt).toStrictEqual(originalCreatedAt);
    expect(user.createdAt).not.toStrictEqual(exposedCreatedAt);
  });

  it('should protect updatedAt from external mutation', () => {
    const user = new User(makeUserProps());

    const originalUpdatedAt = user.updatedAt;
    const exposedUpdatedAt = user.updatedAt;

    exposedUpdatedAt.setFullYear(1990);

    expect(user.updatedAt).toStrictEqual(originalUpdatedAt);
    expect(user.updatedAt).not.toStrictEqual(exposedUpdatedAt);
  });

  it('should reject an invalid id', () => {
    expect(() => new User(makeUserProps({ id: '  ' }))).toThrow(InvalidUserError);
    expect(() => new User(makeUserProps({ id: ' random-id ' }))).toThrow(
      InvalidUserError,
    );
  });

  it('should reject an invalid name', () => {
    expect(() => new User(makeUserProps({ name: '  ' }))).toThrow(InvalidUserError);
  });

  it('should reject an invalid role', () => {
    expect(() => new User(makeUserProps({ role: 'INVALID_ROLE' as UserRole }))).toThrow(
      InvalidUserError,
    );
  });

  it('should reject an invalid email', () => {
    expect(
      () =>
        new User(
          makeUserProps({
            email: 'invalid-email',
          }),
        ),
    ).toThrow(InvalidEmailError);
  });

  it('should reject an invalid passwordHash', () => {
    expect(() => new User(makeUserProps({ passwordHash: '  ' }))).toThrow(
      InvalidUserError,
    );
  });

  it('should reject an invalid createdAt', () => {
    expect(
      () =>
        new User(
          makeUserProps({
            createdAt: new Date('invalid'),
          }),
        ),
    ).toThrow(InvalidUserError);
  });

  it('should reject an invalid updatedAt', () => {
    expect(
      () =>
        new User(
          makeUserProps({
            updatedAt: new Date('invalid'),
          }),
        ),
    ).toThrow(InvalidUserError);
  });

  it('should reject an invalid name change', () => {
    const user = new User(makeUserProps());

    const previousName = user.name;
    const previousUpdatedAt = user.updatedAt;

    expect(() => user.changeName('   ')).toThrow(InvalidUserError);
    expect(user.name).toBe(previousName);
    expect(user.updatedAt).toStrictEqual(previousUpdatedAt);
  });

  it('should reject an invalid role change', () => {
    const user = new User(makeUserProps());

    const previousRole = user.role;
    const previousUpdatedAt = user.updatedAt;

    expect(() => user.changeRole('INVALID_ROLE' as UserRole)).toThrow(InvalidUserError);
    expect(user.role).toBe(previousRole);
    expect(user.updatedAt).toStrictEqual(previousUpdatedAt);
  });

  it('should reject an invalid email change', () => {
    const user = new User(makeUserProps());

    const previousEmail = user.email;
    const previousUpdatedAt = user.updatedAt;

    expect(() => user.changeEmail('invalid-email')).toThrow(InvalidEmailError);
    expect(user.email).toBe(previousEmail);
    expect(user.updatedAt).toStrictEqual(previousUpdatedAt);
  });
});
