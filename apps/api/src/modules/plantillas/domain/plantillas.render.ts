// Variables de las plantillas: {{nombre}}, {{municipio}}… Se reemplazan al preparar cada mensaje.
import type { VariablesPlantilla } from '../types/plantillas.types';

export const VARIABLES: Record<keyof VariablesPlantilla, string> = {
  nombre: 'Nombre del negocio',
  municipio: 'Ciudad del negocio',
  departamento: 'Departamento',
  categoria: 'Categoría (ej. restaurantes y comidas)',
  remitente: 'Tu nombre (quien envía)',
  empresa: 'Nombre de tu empresa',
};

const PATRON = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** Variables usadas en el texto que no existen (para rechazar plantillas con errores de digitación). */
export function variablesDesconocidas(texto: string): string[] {
  const malas = new Set<string>();
  for (const [, nombre] of texto.matchAll(PATRON)) if (!(nombre in VARIABLES)) malas.add(nombre);
  return [...malas];
}

export function renderizar(texto: string, valores: VariablesPlantilla): string {
  return texto.replace(PATRON, (todo, nombre: string) => (nombre in valores ? valores[nombre as keyof VariablesPlantilla] : todo));
}

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e']);

/** "SAN JOSÉ DEL GUAVIARE" → "San José del Guaviare" (los municipios llegan en mayúsculas). */
export function capitalizar(texto: string): string {
  return texto
    .toLocaleLowerCase('es-CO')
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es-CO') + p.slice(1)))
    .join(' ');
}

// Siglas y formas societarias que se dejan en mayúsculas al normalizar nombres de negocios.
const SIGLAS = new Set(['SAS', 'SA', 'LTDA', 'EU', 'EIRL', 'SCA', 'SCS', 'ESP', 'IPS', 'EPS', 'ESE', 'CI', 'BIC', 'DC', 'NIT', 'TV', 'II', 'III', 'IV']);
const VOCAL = /[aeiouáéíóúü]/i;

/**
 * Nombre de negocio o departamento para un mensaje: "AUTODORADO TRANSPORTE ESPECIAL S.A.S." →
 * "Autodorado Transporte Especial S.A.S.". Solo toca textos escritos todo en mayúsculas (si alguien
 * ya los escribió con su forma, se respetan) y deja como están las siglas: con puntos (S.A.S., D.C.),
 * conocidas (SAS, LTDA, IPS…), sin vocales (NH, CRM) o con números.
 */
export function capitalizarNombre(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (limpio !== limpio.toLocaleUpperCase('es-CO')) return limpio;
  return limpio
    .split(' ')
    .map((palabra, i) => {
      const letras = palabra.replace(/[^\p{L}\p{N}]/gu, '');
      if (!letras) return palabra;
      if (palabra.includes('.') && letras.length <= 4) return palabra;
      const minus = palabra.toLocaleLowerCase('es-CO');
      if (i > 0 && MINUSCULAS.has(letras.toLocaleLowerCase('es-CO'))) return minus;
      if (SIGLAS.has(letras) || /\d/.test(letras) || !VOCAL.test(letras)) return palabra;
      return minus.replace(/\p{L}/u, (l) => l.toLocaleUpperCase('es-CO'));
    })
    .join(' ');
}
