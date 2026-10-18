import * as n from '~utils/normalizar';

describe('teléfonos', () => {
  it('quedan en +57 y 10 dígitos', () => {
    expect(n.normalizarTelefono('300-123-4567')).toEqual({ numero: '+573001234567', tipo: 'movil' });
    expect(n.normalizarTelefono('+57 604 5550101')).toEqual({ numero: '+576045550101', tipo: 'fijo' });
    expect(n.normalizarTelefono('(4) 444 5555')).toEqual({ numero: '+576044445555', tipo: 'fijo' });
    expect(n.normalizarTelefono('4445555', '05')).toEqual({ numero: '+576044445555', tipo: 'fijo' });
    expect(n.normalizarTelefono('6614455', '50')).toEqual({ numero: '+576086614455', tipo: 'fijo' });
    expect(n.normalizarTelefono('0057 310 2071086')).toEqual({ numero: '+573102071086', tipo: 'movil' });
    expect(n.normalizarTelefono('555 06 01 Ext 129', '05')).toEqual({ numero: '+576045550601', tipo: 'fijo' });
  });

  it('descarta basura y no adivina el indicativo', () => {
    expect(n.normalizarTelefono('+57-4-???', '05')).toBeNull();
    expect(n.normalizarTelefono('4445555')).toBeNull();
    expect(n.normalizarTelefonos('+57 300 5550102;+57 604 5550103', '05')).toHaveLength(2);
  });
});

describe('dominios, correos y NIT', () => {
  it('redes y correos gratuitos no cuentan como dominio propio', () => {
    expect(n.normalizarDominio('https://www.Ferreteria-Tornillo.com.co/contacto')).toBe('ferreteria-tornillo.com.co');
    expect(n.normalizarDominio('https://www.facebook.com/miferreteria')).toBeNull();
    expect(n.normalizarDominio('No Provisto')).toBeNull();
  });

  it('correos y NIT', () => {
    expect(n.normalizarEmails(['A@B.co; c@d.co', 'no-es-correo', 'No Provisto'])).toEqual(['a@b.co', 'c@d.co']);
    expect(n.normalizarNit('900.123.456-7')).toBe('900123456');
    expect(n.pareceNitDeEmpresa('900123456')).toBe(true);
    expect(n.pareceNitDeEmpresa('1036000000')).toBe(false);
  });
});

describe('nombres', () => {
  it('ignora sufijos societarios y palabras genéricas', () => {
    expect(n.normalizarNombreEmpresa('Ferretería La Rebaja S.A.S.')).toBe('ferreteria rebaja');
    expect(n.similitudNombres('Hotel Oasis', 'HOTEL EL OASIS SAS')).toBe(1);
    expect(n.similitudNombres('Hotel Dorado', 'HOTEL EL OASIS SAS')).toBe(0);
    expect(n.similitudNombres('Ferretería', 'FERRETERIA SAS')).toBe(0);
    expect(n.similitudNombres('Confort Boutique', 'HOTEL CONFORT BOUTIQUE SAS')).toBe(1);
    expect(n.similitudNombres('Hotel Rionegro', 'Ferretería Rionegro', new Set(['rionegro']))).toBe(0);
  });
});

describe('direcciones', () => {
  it.each([
    ['KR 51 47 25', 'Carrera 51 # 47-25'],
    ['DG 50 B 46 16', 'Diagonal 50B # 46-16'],
    ['KR 50 46 23 BR CENTRO', 'Cra. 50 #46-23'],
    ['CL 23 N 23 05', 'Calle 23 # 23-5'],
    ['CR 50  CL 46 23', 'Carrera 50 # 46-23'],
    ['TV 42 C 52 C 30', 'Transversal 42C # 52C-30'],
  ])('%s = %s', (a, b) => {
    expect(n.normalizarDireccion(a)).not.toBeNull();
    expect(n.normalizarDireccion(a)).toBe(n.normalizarDireccion(b));
  });

  it('sin placa → null', () => {
    expect(n.normalizarDireccion('Vereda Sajonia km 22')).toBeNull();
  });
});
