// Responses with the SAME shape the real services return (checked
// against DANE, Overpass and datos.gov.co in Oct 2026). Names, NITs and
// phones are made up. Municipality: Rionegro, Antioquia (05615).

import type { FetchLike } from '~services/sources/http';

export const daneResponse = {
  consulta: 'SELECT ... FROM MARCO_DIR_EST_EMPRESA WHERE ...',
  estado: true,
  resultado: [
    {
      TIPO_DOCUMENTO: '', NIT: '900111222', RAZON_SOCIAL: 'HOTEL EL MIRADOR DEL ORIENTE SAS', NOMBRE_COMERCIAL: '',
      DIRECCION: 'CL 49 50 20', MUNI_ID_DPTO: '05', MUNI_ID_MPIO: '615', TELEFONO1: '',
      CIIU_ID_CIIU_3_V: '', CIIU_ID_CIIU_4_V: '5511', LONGITUD: '-75.373500', LATITUD: '6.151400', GRUPO_CIIU4: '551',
    },
    {
      TIPO_DOCUMENTO: '', NIT: '901333444', RAZON_SOCIAL: 'INVERSIONES CASA ALBORADA S.A.S.', NOMBRE_COMERCIAL: '',
      DIRECCION: 'KR 50 45 10', MUNI_ID_DPTO: '05', MUNI_ID_MPIO: '615', TELEFONO1: '',
      CIIU_ID_CIIU_3_V: '', CIIU_ID_CIIU_4_V: '5511', LONGITUD: '-75.370800', LATITUD: '6.156200', GRUPO_CIIU4: '551',
    },
    {
      TIPO_DOCUMENTO: '', NIT: '800555666', RAZON_SOCIAL: 'HOSPEDAJES DEL VALLE LTDA', NOMBRE_COMERCIAL: '',
      DIRECCION: 'CL 41 55 03', MUNI_ID_DPTO: '05', MUNI_ID_MPIO: '615', TELEFONO1: '',
      CIIU_ID_CIIU_3_V: '', CIIU_ID_CIIU_4_V: '5519', LONGITUD: '-75.390000', LATITUD: '6.140000', GRUPO_CIIU4: '551',
    },
  ],
};

export const overpassResponse = {
  version: 0.6,
  elements: [
    { type: 'relation', id: 3947503 },
    {
      // Same hotel as DANE (trade name 15 m away) → merged by name and proximity
      type: 'node', id: 1001, lat: 6.15153, lon: -75.37342,
      tags: { tourism: 'hotel', name: 'Hotel Mirador del Oriente', phone: '+57 604 5550101', website: 'https://www.hotelmirador.example.co/' },
    },
    {
      // The same hotel drawn as a building → does not create a second lead
      type: 'way', id: 2002, center: { lat: 6.15156, lon: -75.37345 },
      tags: { tourism: 'hotel', name: 'Hotel Mirador del Oriente', building: 'hotel' },
    },
    {
      // Trade name different from the legal name, but same street number as DANE → merged by address
      type: 'node', id: 1003, lat: 6.1561, lon: -75.37075,
      tags: {
        tourism: 'guest_house', name: 'Hostal Las Golondrinas', 'addr:street': 'Carrera 50', 'addr:housenumber': '45-10',
        'contact:whatsapp': '300 555 0102', 'contact:phone': '+57 300 5550102;+57 604 5550103',
        website: 'https://www.facebook.com/hostalgolondrinas',
      },
    },
    { type: 'node', id: 1004, lat: 6.151, lon: -75.3735, tags: { tourism: 'hotel', name: 'Hotel' } },
    { type: 'node', id: 1005, lat: 6.17249, lon: -75.4355, tags: { tourism: 'hotel', name: 'Hotel Aeropuerto Express', phone: '+57-4-???' } },
    {
      // It is in the RNT (no coordinates) with the same street number → merged by address
      type: 'node', id: 1006, lat: 6.15451, lon: -75.37062,
      tags: { tourism: 'hotel', name: 'Hotel El Turista', 'addr:street': 'Carrera 46', 'addr:housenumber': '51-18' },
    },
  ],
};

export const rntRows = [
  {
    codigo_rnt: '11001', nit: '900111222', razon_social_establecimiento: 'HOTEL MIRADOR DEL ORIENTE',
    direcci_n_comercial_establecimiento: 'CL 49 50 20', cod_mun: '05615', num_celular: '3005550201', n_m_tel_fono: '5550202',
    correo_establecimiento: 'reservas@mirador.example.co', correo_prestador: 'gerencia@mirador.example.co',
    categoria: 'ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO', sub_categoria: 'HOTEL', tipo_prestador: 'Comerciante', estado_rnt: 'ACTIVO',
  },
  {
    codigo_rnt: '11002', nit: '800555666', razon_social_establecimiento: 'HOSPEDAJES DEL VALLE',
    direcci_n_comercial_establecimiento: 'CL 41 55 03', cod_mun: '05615', num_celular: '3005550301', n_m_tel_fono: '',
    correo_establecimiento: 'info@hospedajesvalle.example.co', correo_prestador: '',
    categoria: 'ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO', sub_categoria: 'HOSTAL', tipo_prestador: 'Comerciante', estado_rnt: 'ACTIVO',
  },
  {
    // Individual (NIT = cédula) → skipped unless individuals are requested
    codigo_rnt: '11003', nit: '1036000000', razon_social_establecimiento: 'APARTAMENTO LAS FLORES',
    direcci_n_comercial_establecimiento: 'CL 30 40 10', cod_mun: '05615', num_celular: '3005550401', n_m_tel_fono: '',
    correo_establecimiento: 'persona@correo.example.co', correo_prestador: '',
    categoria: 'ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO', sub_categoria: 'HOTEL', tipo_prestador: 'No Comerciante', estado_rnt: 'ACTIVO',
  },
  {
    codigo_rnt: '11004', nit: '901777888', razon_social_establecimiento: 'HOTEL EL TURISTA',
    direcci_n_comercial_establecimiento: 'CR 46 51 18', cod_mun: '05615', num_celular: '3195550501', n_m_tel_fono: '',
    correo_establecimiento: 'hoteleltutista@correo.example.co', correo_prestador: '',
    categoria: 'ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO', sub_categoria: 'HOTEL', tipo_prestador: 'Comerciante', estado_rnt: 'ACTIVO',
  },
];

export const secopRows = [
  {
    codigo: '700001', nit: '901333444', nombre: 'INVERSIONES CASA ALBORADA S.A.S.', telefono: '6045550601',
    correo: 'contacto@casaalborada.example.co', sitio_web: 'WWW.CASAALBORADA.EXAMPLE.CO', direccion: 'KR 50 45 10',
    ubicacion: 'CO-ANT-05615', tipo_empresa: 'SOCIEDAD POR ACCIONES SIMPLIFICADA', esta_activa: 'Si',
    codigo_categoria_principal: 'V1.90111500', descripcion_categoria_principal: 'Hoteles y moteles y pensiones', espyme: 'SI',
  },
  {
    codigo: '700002', nit: '901999000', nombre: 'OPERADORA TURISTICA ANDINA SAS', telefono: '3005550701',
    correo: 'ventas@operadoraandina.example.co', sitio_web: 'No Provisto', direccion: 'CL 52 48 30',
    ubicacion: 'CO-ANT-05615', tipo_empresa: 'SOCIEDAD POR ACCIONES SIMPLIFICADA', esta_activa: 'Si',
    codigo_categoria_principal: 'V1.90111600', descripcion_categoria_principal: 'Alojamiento', espyme: 'SI',
  },
];

export const repsRows = [
  {
    codigohabilitacionsede: '056150000101', nombresede: 'IPS SALUD ORIENTE SEDE RIONEGRO', nombreprestador: 'IPS SALUD ORIENTE S.A.S.',
    tipoid: 'NI', numeroidentificacion: '900222333', claseprestador: 'Instituciones Prestadoras de Servicios de Salud - IPS',
    municipiosede: '05615', direcci_nsede: 'Calle 50 # 48-20', t_lefonosede: '555 06 01 Ext 129', telefonoprestador: '3005550801',
    email_sede: 'citas@saludoriente.example.co', email_prestador: 'gerencia@saludoriente.example.co',
  },
];

export interface FakeNetwork {
  fetch: FetchLike;
  calls: { url: string; body?: string }[];
  /** source → failure mode */
  fail: Partial<Record<'dane' | 'osm' | 'data', 'network' | 429>>;
  osmUnlimited: boolean;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Simulated fetch that responds like the real services. */
export function createFakeNetwork(): FakeNetwork {
  const network: FakeNetwork = {
    calls: [],
    fail: {},
    osmUnlimited: false,
    fetch: async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? init.body : undefined;
      network.calls.push({ url, body });
      const type = url.includes('geoportal.dane.gov.co') ? 'dane' : url.includes('datos.gov.co') ? 'data' : 'osm';
      const failure = network.fail[type];
      if (failure === 'network') throw new TypeError('fetch failed');
      if (failure === 429) {
        delete network.fail[type];
        return new Response('Too Many Requests', { status: 429 });
      }
      if (type === 'dane') return json(daneResponse);
      if (type === 'data') {
        const offset = Number(new URL(url).searchParams.get('$offset') ?? 0);
        if (offset > 0) return json([]);
        if (url.includes('thwd-ivmp')) return json(rntRows);
        if (url.includes('qmzu-gj57')) return json(secopRows);
        if (url.includes('c36g-9fc2')) return json(repsRows);
        return json([]);
      }
      const query = new URLSearchParams(body).get('data') ?? '';
      if (network.osmUnlimited && query.includes('divipola')) return json({ elements: [] });
      return json(overpassResponse);
    },
  };
  return network;
}
