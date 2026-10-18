import { consultaPorDivipola, osmACandidato } from '~services/fuentes/osm';
import { obtenerMunicipio } from '~utils/divipola';

describe('fuente OpenStreetMap', () => {
  it('la consulta usa el código DIVIPOLA y valida etiquetas', () => {
    const q = consultaPorDivipola('05615', ['shop=hardware', 'office'], 60);
    expect(q).toContain('["divipola"="05615"]');
    expect(q).toContain('nwr(area.zona)["shop"="hardware"]["name"];');
    expect(q).toContain('nwr(area.zona)["office"]["name"];');
    expect(() => consultaPorDivipola('05615', ['shop"];out;'], 60)).toThrow();
    expect(() => consultaPorDivipola('5615', ['shop'], 60)).toThrow();
  });

  it('elemento → candidato (WhatsApp, redes, coordenadas de edificios)', () => {
    const c = osmACandidato(
      {
        type: 'way', id: 7, center: { lat: 6.15, lon: -75.37 },
        tags: {
          shop: 'hardware', name: 'Ferretería El Tornillo', 'contact:whatsapp': '+57 300 1234567', phone: '4445555',
          website: 'https://instagram.com/eltornillo', email: 'Ventas@ElTornillo.co', 'addr:street': 'Calle 50', 'addr:housenumber': '45-12',
        },
      },
      obtenerMunicipio('05615')!
    );
    expect(c.idExterno).toBe('way/7');
    expect(c.lat).toBe(6.15);
    expect(c.telefonos).toEqual(expect.arrayContaining([{ numero: '+573001234567', tipo: 'movil', whatsapp: true }, { numero: '+576044445555', tipo: 'fijo' }]));
    expect(c.sitiosWeb).toEqual([]);
    expect(c.redes).toEqual(['https://instagram.com/eltornillo']);
    expect(c.emails).toEqual(['ventas@eltornillo.co']);
    expect(c.direccion).toBe('Calle 50 # 45-12');
    expect(c.categoriaFuente).toBe('shop=hardware');
  });
});
