import { CacheTtl, withTimeout } from '~utils/cacheTtl';

describe('CacheTtl', () => {
  it('expires according to the TTL and drops the oldest entry when full', () => {
    let t = 0;
    const c = new CacheTtl<number>(1000, 2, () => t);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    t = 1000;
    expect(c.get('b')).toBeUndefined();
  });

  it('with TTL 0 it stores nothing', () => {
    const c = new CacheTtl<number>(0);
    c.set('a', 1);
    expect(c.get('a')).toBeUndefined();
  });
});

describe('withTimeout', () => {
  it('rejects if the promise takes longer than the limit', async () => {
    const slow = new Promise((r) => setTimeout(r, 200));
    await expect(withTimeout(slow, 20, 'tarde')).rejects.toThrow('tarde');
    await expect(withTimeout(Promise.resolve(5), 20, 'tarde')).resolves.toBe(5);
  });
});
