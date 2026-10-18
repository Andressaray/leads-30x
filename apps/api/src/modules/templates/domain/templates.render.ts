// Template variables: {{nombre}}, {{municipio}}… They are replaced when each message is prepared.
// The placeholders stay in Spanish because the sales team types them in its messages;
// internally each one maps to an English field of TemplateVariables.
import type { TemplateVariables } from '../types/templates.types';

/** Placeholder the user writes in the template → field it is filled with. */
export const PLACEHOLDERS: Record<keyof TemplateVariables, string> = {
  name: 'nombre',
  municipality: 'municipio',
  department: 'departamento',
  category: 'categoria',
  sender: 'remitente',
  company: 'empresa',
};
const FIELD_BY_PLACEHOLDER = new Map(Object.entries(PLACEHOLDERS).map(([field, placeholder]) => [placeholder, field as keyof TemplateVariables]));

export const VARIABLES: Record<keyof TemplateVariables, string> = {
  name: 'Nombre del negocio',
  municipality: 'Ciudad del negocio',
  department: 'Departamento',
  category: 'Categoría (ej. restaurantes y comidas)',
  sender: 'Tu nombre (quien envía)',
  company: 'Nombre de tu empresa',
};

const PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** Variables used in the text that do not exist (to reject templates with typos). */
export function unknownVariables(text: string): string[] {
  const bad = new Set<string>();
  for (const [, name] of text.matchAll(PATTERN)) if (!FIELD_BY_PLACEHOLDER.has(name)) bad.add(name);
  return [...bad];
}

export function render(text: string, values: TemplateVariables): string {
  return text.replace(PATTERN, (all, name: string) => {
    const field = FIELD_BY_PLACEHOLDER.get(name);
    return field ? values[field] : all;
  });
}

const LOWERCASE = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e']);

/** "SAN JOSÉ DEL GUAVIARE" → "San José del Guaviare" (municipalities arrive in uppercase). */
export function capitalize(text: string): string {
  return text
    .toLocaleLowerCase('es-CO')
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && LOWERCASE.has(p) ? p : p.charAt(0).toLocaleUpperCase('es-CO') + p.slice(1)))
    .join(' ');
}

// Acronyms and company forms that stay uppercase when normalizing business names.
const ACRONYMS = new Set(['SAS', 'SA', 'LTDA', 'EU', 'EIRL', 'SCA', 'SCS', 'ESP', 'IPS', 'EPS', 'ESE', 'CI', 'BIC', 'DC', 'NIT', 'TV', 'II', 'III', 'IV']);
const VOCAL = /[aeiouáéíóúü]/i;

/**
 * Business or department name for a message: "AUTODORADO TRANSPORTE ESPECIAL S.A.S." →
 * "Autodorado Transporte Especial S.A.S.". It only touches texts written entirely in uppercase (if someone
 * already wrote them with their own casing, they are respected) and leaves acronyms as they are: with dots (S.A.S., D.C.),
 * known ones (SAS, LTDA, IPS…), without vowels (NH, CRM) or with numbers.
 */
export function capitalizeName(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean !== clean.toLocaleUpperCase('es-CO')) return clean;
  return clean
    .split(' ')
    .map((word, i) => {
      const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
      if (!letters) return word;
      if (word.includes('.') && letters.length <= 4) return word;
      const minus = word.toLocaleLowerCase('es-CO');
      if (i > 0 && LOWERCASE.has(letters.toLocaleLowerCase('es-CO'))) return minus;
      if (ACRONYMS.has(letters) || /\d/.test(letters) || !VOCAL.test(letters)) return word;
      return minus.replace(/\p{L}/u, (l) => l.toLocaleUpperCase('es-CO'));
    })
    .join(' ');
}
