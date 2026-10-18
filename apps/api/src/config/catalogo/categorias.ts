// Equivalencias entre una categoría de negocio y cómo la nombra cada fuente.
// Para agregar una categoría basta con sumar una entrada aquí.
//
//   osm    etiquetas de OpenStreetMap
//   ciiu   códigos CIIU Rev. 4 A.C. (DANE)
//   rnt    valores del campo "categoria" del Registro Nacional de Turismo
//   secop  prefijos UNSPSC de la categoría principal del proveedor en SECOP II
//   reps   true si aplica el registro de prestadores de salud

export interface DefinicionCategoria {
  nombre: string;
  osm: string[];
  ciiu: string[];
  rnt?: string[];
  secop?: string[];
  reps?: boolean;
}

export const CATEGORIAS: Record<string, DefinicionCategoria> = {
  ferreteria: {
    nombre: 'Ferreterías',
    osm: ['shop=hardware', 'shop=doityourself', 'shop=trade'],
    ciiu: ['4752', '4663'],
    secop: ['27', '30', '31'],
  },
  restaurante: {
    nombre: 'Restaurantes y comidas',
    osm: ['amenity=restaurant', 'amenity=fast_food', 'amenity=cafe', 'amenity=food_court'],
    ciiu: ['5611', '5612', '5613', '5619'],
    rnt: ['ESTABLECIMIENTOS DE GASTRONOMÍA'],
    secop: ['9010'],
  },
  bar: {
    nombre: 'Bares y discotecas',
    osm: ['amenity=bar', 'amenity=pub', 'amenity=nightclub'],
    ciiu: ['5630'],
    rnt: ['BARES'],
  },
  hotel: {
    nombre: 'Hoteles y alojamiento',
    osm: ['tourism=hotel', 'tourism=hostel', 'tourism=guest_house', 'tourism=motel', 'tourism=apartment'],
    ciiu: ['5511', '5512', '5513', '5514', '5519', '5530'],
    rnt: ['ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO'],
    secop: ['9011'],
  },
  agencia_viajes: {
    nombre: 'Agencias de viajes',
    osm: ['shop=travel_agency', 'office=travel_agent'],
    ciiu: ['7911', '7912', '7990'],
    rnt: ['AGENCIAS DE VIAJES'],
    secop: ['9012'],
  },
  transporte: {
    nombre: 'Transporte de pasajeros',
    osm: ['office=transport', 'amenity=taxi'],
    ciiu: ['4921', '4922'],
    rnt: ['EMPRESAS DE TRANSPORTE TERRESTRE AUTOMOTOR'],
    secop: ['7811'],
  },
  farmacia: {
    nombre: 'Droguerías y farmacias',
    osm: ['amenity=pharmacy', 'shop=chemist'],
    ciiu: ['4773'],
    secop: ['51'],
  },
  supermercado: {
    nombre: 'Supermercados y tiendas',
    osm: ['shop=supermarket', 'shop=convenience', 'shop=general', 'shop=greengrocer', 'shop=butcher'],
    ciiu: ['4711', '4719', '4721', '4729'],
    secop: ['50'],
  },
  panaderia: {
    nombre: 'Panaderías',
    osm: ['shop=bakery', 'shop=pastry'],
    ciiu: ['1081', '1089'],
    secop: ['5018'],
  },
  odontologia: {
    nombre: 'Odontología',
    osm: ['amenity=dentist', 'healthcare=dentist'],
    ciiu: ['8622'],
    reps: true,
  },
  salud: {
    nombre: 'Clínicas, consultorios y laboratorios',
    osm: ['amenity=clinic', 'amenity=doctors', 'amenity=hospital', 'healthcare=clinic', 'healthcare=doctor', 'healthcare=laboratory', 'healthcare=physiotherapist'],
    ciiu: ['8610', '8621', '8691', '8692', '8699'],
    secop: ['85'],
    reps: true,
  },
  veterinaria: {
    nombre: 'Veterinarias y tiendas de mascotas',
    osm: ['amenity=veterinary', 'shop=pet'],
    ciiu: ['7500'],
  },
  belleza: {
    nombre: 'Peluquerías y estética',
    osm: ['shop=hairdresser', 'shop=beauty', 'shop=cosmetics'],
    ciiu: ['9602'],
  },
  taller: {
    nombre: 'Talleres de vehículos y motos',
    osm: ['shop=car_repair', 'shop=motorcycle_repair', 'shop=tyres'],
    ciiu: ['4520', '4542'],
    secop: ['7818'],
  },
  repuestos: {
    nombre: 'Repuestos y venta de vehículos',
    osm: ['shop=car_parts', 'shop=motorcycle', 'shop=car'],
    ciiu: ['4511', '4512', '4530', '4541'],
    secop: ['25'],
  },
  gimnasio: {
    nombre: 'Gimnasios y centros deportivos',
    osm: ['leisure=fitness_centre', 'leisure=sports_centre'],
    ciiu: ['9311', '9312', '9319'],
  },
  ropa: {
    nombre: 'Ropa y calzado',
    osm: ['shop=clothes', 'shop=shoes', 'shop=boutique'],
    ciiu: ['4771', '4772'],
    secop: ['53'],
  },
  tecnologia: {
    nombre: 'Computadores, celulares y electrónica',
    osm: ['shop=computer', 'shop=electronics', 'shop=mobile_phone'],
    ciiu: ['4741', '4742', '9511', '9512'],
    secop: ['43', '8111'],
  },
  construccion: {
    nombre: 'Construcción y acabados',
    osm: ['office=construction_company', 'craft=builder', 'craft=electrician', 'craft=plumber'],
    ciiu: ['4111', '4112', '4290', '4321', '4322', '4330'],
    secop: ['72'],
  },
  abogados: {
    nombre: 'Abogados',
    osm: ['office=lawyer'],
    ciiu: ['6910'],
    secop: ['8012'],
  },
  contadores: {
    nombre: 'Contadores y asesoría tributaria',
    osm: ['office=accountant', 'office=tax_advisor'],
    ciiu: ['6920'],
    secop: ['8411'],
  },
  inmobiliaria: {
    nombre: 'Inmobiliarias',
    osm: ['office=estate_agent'],
    ciiu: ['6810', '6820'],
    secop: ['8013'],
  },
};

/** Sin categoría, en OSM se buscan "todos los negocios" con estas etiquetas. */
export const OSM_TODOS = [
  'shop',
  'office',
  'craft',
  'amenity=restaurant', 'amenity=fast_food', 'amenity=cafe', 'amenity=bar', 'amenity=pub',
  'amenity=nightclub', 'amenity=pharmacy', 'amenity=dentist', 'amenity=clinic',
  'amenity=doctors', 'amenity=veterinary', 'amenity=fuel', 'amenity=car_wash',
  'tourism=hotel', 'tourism=hostel', 'tourism=guest_house', 'tourism=motel',
  'healthcare', 'leisure=fitness_centre',
];

const RE_CLAVE_OSM = /^[a-z][a-z0-9_:]{0,40}$/;
const RE_VALOR_OSM = /^[A-Za-z0-9_:-]{1,40}$/;

/** "shop=hardware" | "shop" → { clave, valor } validado (evita inyectar en Overpass). */
export function parsearEtiquetaOsm(texto: string): { clave: string; valor?: string } | null {
  const [clave, valor, ...resto] = String(texto).trim().split('=');
  if (resto.length || !RE_CLAVE_OSM.test(clave || '')) return null;
  if (valor !== undefined && !RE_VALOR_OSM.test(valor)) return null;
  return { clave, valor };
}

export function esCiiuValido(codigo: string): boolean {
  return /^\d{4}$/.test(String(codigo));
}

/** "ferreterias", "Hoteles", "restaurantes" → clave del catálogo, o null. */
export function normalizarClaveCategoria(texto: string): string | null {
  let clave = String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/s$/, '');
  if (CATEGORIAS[clave]) return clave;
  if (clave.length < 3) return null;
  const alt = Object.keys(CATEGORIAS).find((k) => clave.startsWith(k) || k.startsWith(clave) || clave === `${k}e`);
  return alt ?? null;
}
