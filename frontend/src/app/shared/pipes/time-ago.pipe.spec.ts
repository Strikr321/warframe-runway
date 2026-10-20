import { TimeAgoPipe } from './time-ago.pipe';

describe('TimeAgoPipe', () => {
  const pipe = new TimeAgoPipe();
  const now = new Date('2026-10-19T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [30_000, 'just now'],
    [60_000, '1 minute ago'],
    [5 * 60_000, '5 minutes ago'],
    [3_600_000, '1 hour ago'],
    [2 * 86_400_000, '2 days ago'],
    [15 * 86_400_000, '2 weeks ago'],
  ])('formats %i ms ago as "%s"', (ms, expected) => {
    expect(pipe.transform(ago(ms))).toBe(expected);
  });

  it('returns an empty string for an invalid date', () => {
    expect(pipe.transform('not a date')).toBe('');
  });
});
