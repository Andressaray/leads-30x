// Respuestas con la MISMA forma que devuelven los servicios reales (verificada
// contra el DANE, Overpass y datos.gov.co en oct-2026). Nombres, NIT y
// teléfonos son inventados. Municipio: Rionegro, Antioquia (05615).

import type { FetchLike } from '~services/fuentes/http';

export const respuestaDane = {
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

export const respuestaOverpass = {
  version: 0.6,
  elements: [
    { type: 'relation', id: 3947503 },
    {
      // Mismo hotel que el DANE (nombre comercial a 15 m) → se fusiona por nombre y cercanía
      type: 'node', id: 1001, lat: 6.15153, lon: -75.37342,
      tags: { tourism: 'hotel', name: 'Hotel Mirador del Oriente', phone: '+57 604 5550101', website: 'https://www.hotelmirador.example.co/' },
    },
    {
      // El mismo hotel dibujado como edificio → no crea un segundo lead
      type: 'way', id: 2002, center: { lat: 6.15156, lon: -75.37345 },
      tags: { tourism: 'hotel', name: 'Hotel Mirador del Oriente', building: 'hotel' },
    },
    {
      // Nombre comercial distinto a la razón social, pero misma placa que el DANE → se une por dirección
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
      // Está en el RNT (sin coordenadas) con la misma placa → se une por dirección
      type: 'node', id: 1006, lat: 6.15451, lon: -75.37062,
      tags: { tourism: 'hotel', name: 'Hotel El Turista', 'addr:street': 'Carrera 46', 'addr:housenumber': '51-18' },
    },
  ],
};

export const filasRnt = [
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
    // Persona natural (NIT = cédula) → se omite si no se piden personas naturales
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

export const filasSecop = [
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

export const filasReps = [
  {
    codigohabilitacionsede: '056150000101', nombresede: 'IPS SALUD ORIENTE SEDE RIONEGRO', nombreprestador: 'IPS SALUD ORIENTE S.A.S.',
    tipoid: 'NI', numeroidentificacion: '900222333', claseprestador: 'Instituciones Prestadoras de Servicios de Salud - IPS',
    municipiosede: '05615', direcci_nsede: 'Calle 50 # 48-20', t_lefonosede: '555 06 01 Ext 129', telefonoprestador: '3005550801',
    email_sede: 'citas@saludoriente.example.co', email_prestador: 'gerencia@saludoriente.example.co',
  },
];

export interface RedFalsa {
  fetch: FetchLike;
  llamadas: { url: string; body?: string }[];
  /** fuente → modo de falla */
  fallar: Partial<Record<'dane' | 'osm' | 'datos', 'red' | 429>>;
  osmSinLimite: boolean;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

/** fetch simulado que responde como los servicios reales. */
export function crearRedFalsa(): RedFalsa {
  const red: RedFalsa = {
    llamadas: [],
    fallar: {},
    osmSinLimite: false,
    fetch: async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? init.body : undefined;
      red.llamadas.push({ url, body });
      const tipo = url.includes('geoportal.dane.gov.co') ? 'dane' : url.includes('datos.gov.co') ? 'datos' : 'osm';
      const falla = red.fallar[tipo];
      if (falla === 'red') throw new TypeError('fetch failed');
      if (falla === 429) {
        delete red.fallar[tipo];
        return new Response('Too Many Requests', { status: 429 });
      }
      if (tipo === 'dane') return json(respuestaDane);
      if (tipo === 'datos') {
        const offset = Number(new URL(url).searchParams.get('$offset') ?? 0);
        if (offset > 0) return json([]);
        if (url.includes('thwd-ivmp')) return json(filasRnt);
        if (url.includes('qmzu-gj57')) return json(filasSecop);
        if (url.includes('c36g-9fc2')) return json(filasReps);
        return json([]);
      }
      const consulta = new URLSearchParams(body).get('data') ?? '';
      if (red.osmSinLimite && consulta.includes('divipola')) return json({ elements: [] });
      return json(respuestaOverpass);
    },
  };
  return red;
}
