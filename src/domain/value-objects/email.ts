import { InvalidEmailError } from '../errors/invalid-email-error';

class Email {
  public readonly value: string;

  constructor(value: string) {
    const normalizedEmail = Email.normalize(value);

    if (!Email.isValid(normalizedEmail)) {
      throw new InvalidEmailError();
    }

    this.value = normalizedEmail;
  }

  equals(otherEmail: Email): boolean {
    return this.value === otherEmail.value;
  }

  private static normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private static isValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}

export { Email };
