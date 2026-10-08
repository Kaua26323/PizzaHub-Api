import type { Clock } from '@/application/services/clock';

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export { SystemClock };
