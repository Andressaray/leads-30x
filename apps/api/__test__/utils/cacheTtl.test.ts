import { CacheTtl, conLimiteDeTiempo } from '~utils/cacheTtl';

describe('CacheTtl', () => {
  it('vence según el TTL y descarta la entrada más antigua al llenarse', () => {
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

  it('con TTL 0 no guarda nada', () => {
    const c = new CacheTtl<number>(0);
    c.set('a', 1);
    expect(c.get('a')).toBeUndefined();
  });
});

describe('conLimiteDeTiempo', () => {
  it('rechaza si la promesa tarda más que el límite', async () => {
    const lenta = new Promise((r) => setTimeout(r, 200));
    await expect(conLimiteDeTiempo(lenta, 20, 'tarde')).rejects.toThrow('tarde');
    await expect(conLimiteDeTiempo(Promise.resolve(5), 20, 'tarde')).resolves.toBe(5);
  });
});
