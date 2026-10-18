import { createUnsubscribeToken, readUnsubscribeToken } from '~utils/unsubscribeToken';

const SECRET = 'test-secret-test-secret-test-secret';

describe('unsubscribe token', () => {
  it('round trip', () => {
    expect(readUnsubscribeToken(createUnsubscribeToken(42, SECRET), SECRET)).toBe(42);
  });

  it('does not work for another lead nor with another secret', () => {
    const signature = createUnsubscribeToken(42, SECRET).split('.')[1];
    expect(readUnsubscribeToken(`43.${signature}`, SECRET)).toBeNull();
    expect(readUnsubscribeToken(createUnsubscribeToken(42, 'other-secret-other-secret-other-secret'), SECRET)).toBeNull();
  });

  it.each(['', 'abc', '42', '42.', '42.corta', 'x.AAAAAAAAAAAAAAAAAAAAAAAA'])('rejects "%s"', (t) => {
    expect(readUnsubscribeToken(t, SECRET)).toBeNull();
  });
});
