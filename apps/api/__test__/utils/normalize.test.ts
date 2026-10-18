import * as n from '~utils/normalize';

describe('phones', () => {
  it('end up as +57 and 10 digits', () => {
    expect(n.normalizePhone('300-123-4567')).toEqual({ number: '+573001234567', type: 'mobile' });
    expect(n.normalizePhone('+57 604 5550101')).toEqual({ number: '+576045550101', type: 'landline' });
    expect(n.normalizePhone('(4) 444 5555')).toEqual({ number: '+576044445555', type: 'landline' });
    expect(n.normalizePhone('4445555', '05')).toEqual({ number: '+576044445555', type: 'landline' });
    expect(n.normalizePhone('6614455', '50')).toEqual({ number: '+576086614455', type: 'landline' });
    expect(n.normalizePhone('0057 310 2071086')).toEqual({ number: '+573102071086', type: 'mobile' });
    expect(n.normalizePhone('555 06 01 Ext 129', '05')).toEqual({ number: '+576045550601', type: 'landline' });
  });

  it('discards junk and does not guess the area code', () => {
    expect(n.normalizePhone('+57-4-???', '05')).toBeNull();
    expect(n.normalizePhone('4445555')).toBeNull();
    expect(n.normalizePhones('+57 300 5550102;+57 604 5550103', '05')).toHaveLength(2);
  });
});

describe('domains, emails and NIT', () => {
  it('social networks and free email providers do not count as an own domain', () => {
    expect(n.normalizeDomain('https://www.Ferreteria-Tornillo.com.co/contacto')).toBe('ferreteria-tornillo.com.co');
    expect(n.normalizeDomain('https://www.facebook.com/miferreteria')).toBeNull();
    expect(n.normalizeDomain('No Provisto')).toBeNull();
  });

  it('emails and NIT', () => {
    expect(n.normalizeEmails(['A@B.co; c@d.co', 'not-an-email', 'No Provisto'])).toEqual(['a@b.co', 'c@d.co']);
    expect(n.normalizeNit('900.123.456-7')).toBe('900123456');
    expect(n.looksLikeCompanyNit('900123456')).toBe(true);
    expect(n.looksLikeCompanyNit('1036000000')).toBe(false);
  });
});

describe('names', () => {
  it('ignores company suffixes and generic words', () => {
    expect(n.normalizeCompanyName('Ferretería La Rebaja S.A.S.')).toBe('ferreteria rebaja');
    expect(n.nameSimilarity('Hotel Oasis', 'HOTEL EL OASIS SAS')).toBe(1);
    expect(n.nameSimilarity('Hotel Dorado', 'HOTEL EL OASIS SAS')).toBe(0);
    expect(n.nameSimilarity('Ferretería', 'FERRETERIA SAS')).toBe(0);
    expect(n.nameSimilarity('Confort Boutique', 'HOTEL CONFORT BOUTIQUE SAS')).toBe(1);
    expect(n.nameSimilarity('Hotel Rionegro', 'Ferretería Rionegro', new Set(['rionegro']))).toBe(0);
  });
});

describe('addresses', () => {
  it.each([
    ['KR 51 47 25', 'Carrera 51 # 47-25'],
    ['DG 50 B 46 16', 'Diagonal 50B # 46-16'],
    ['KR 50 46 23 BR CENTRO', 'Cra. 50 #46-23'],
    ['CL 23 N 23 05', 'Calle 23 # 23-5'],
    ['CR 50  CL 46 23', 'Carrera 50 # 46-23'],
    ['TV 42 C 52 C 30', 'Transversal 42C # 52C-30'],
  ])('%s = %s', (a, b) => {
    expect(n.normalizeAddress(a)).not.toBeNull();
    expect(n.normalizeAddress(a)).toBe(n.normalizeAddress(b));
  });

  it('no street number → null', () => {
    expect(n.normalizeAddress('Vereda Sajonia km 22')).toBeNull();
  });
});
