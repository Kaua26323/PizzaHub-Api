import type { Clock } from '@/application/services/clock';

class FakeClock implements Clock {
  private currentDate: Date;

  constructor(currentDate = new Date('2026-01-01T00:00:00.000Z')) {
    this.currentDate = new Date(currentDate.getTime());
  }

  now(): Date {
    return new Date(this.currentDate.getTime());
  }

  set(currentDate: Date): void {
    this.currentDate = new Date(currentDate.getTime());
  }
}

export { FakeClock };
