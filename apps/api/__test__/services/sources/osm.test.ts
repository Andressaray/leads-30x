import { queryByDivipola, osmToCandidate } from '~services/sources/osm';
import { getMunicipality } from '~utils/divipola';

describe('OpenStreetMap source', () => {
  it('the query uses the DIVIPOLA code and validates tags', () => {
    const q = queryByDivipola('05615', ['shop=hardware', 'office'], 60);
    expect(q).toContain('["divipola"="05615"]');
    expect(q).toContain('nwr(area.zona)["shop"="hardware"]["name"];');
    expect(q).toContain('nwr(area.zona)["office"]["name"];');
    expect(() => queryByDivipola('05615', ['shop"];out;'], 60)).toThrow();
    expect(() => queryByDivipola('5615', ['shop'], 60)).toThrow();
  });

  it('element → candidate (WhatsApp, social links, building coordinates)', () => {
    const c = osmToCandidate(
      {
        type: 'way', id: 7, center: { lat: 6.15, lon: -75.37 },
        tags: {
          shop: 'hardware', name: 'Ferretería El Tornillo', 'contact:whatsapp': '+57 300 1234567', phone: '4445555',
          website: 'https://instagram.com/eltornillo', email: 'Ventas@ElTornillo.co', 'addr:street': 'Calle 50', 'addr:housenumber': '45-12',
        },
      },
      getMunicipality('05615')!
    );
    expect(c.externalId).toBe('way/7');
    expect(c.lat).toBe(6.15);
    expect(c.phones).toEqual(expect.arrayContaining([{ number: '+573001234567', type: 'mobile', whatsapp: true }, { number: '+576044445555', type: 'landline' }]));
    expect(c.websites).toEqual([]);
    expect(c.socialLinks).toEqual(['https://instagram.com/eltornillo']);
    expect(c.emails).toEqual(['ventas@eltornillo.co']);
    expect(c.address).toBe('Calle 50 # 45-12');
    expect(c.sourceCategory).toBe('shop=hardware');
  });
});
