// Translates the user's category into what each source understands.

import { CATEGORIES, OSM_ALL, isValidCiiu, normalizeCategoryKey, parseOsmTag } from '~config/catalog/categories';
import { AppError, HttpCode } from '~response/index';
import type { SearchFilters } from '~types/source.types';

export function resolveFilters(p: { category?: string; ciiu?: string[]; osm?: string[]; includeIndividuals?: boolean }): SearchFilters {
  let key: string | null = null;
  if (p.category && p.category.trim()) {
    key = normalizeCategoryKey(p.category);
    if (!key) throw new AppError(HttpCode.BAD_REQUEST, `Categoría desconocida: "${p.category}". Consulta GET /catalog/categories.`);
  }
  const extraCiiu = (p.ciiu ?? []).map(String);
  const extraOsm = (p.osm ?? []).map(String);
  for (const c of extraCiiu) if (!isValidCiiu(c)) throw new AppError(HttpCode.BAD_REQUEST, `Código CIIU inválido: "${c}" (deben ser 4 dígitos).`);
  for (const t of extraOsm) if (!parseOsmTag(t)) throw new AppError(HttpCode.BAD_REQUEST, `Etiqueta OSM inválida: "${t}" (formato clave=valor).`);

  const def = key ? CATEGORIES[key] : null;
  const all = !key && extraCiiu.length === 0 && extraOsm.length === 0;
  const custom = !key && !all;
  const unique = (xs: string[]) => [...new Set(xs)];

  return {
    category: key,
    name: def ? def.name : all ? 'Todos los negocios' : 'Personalizada',
    all,
    includeIndividuals: Boolean(p.includeIndividuals),
    bySource: {
      dane: { applies: true, values: unique([...(def?.ciiu ?? []), ...extraCiiu]) },
      osm: { applies: true, values: all ? OSM_ALL : unique([...(def?.osm ?? []), ...extraOsm]) },
      // The sector registries are only queried if the category has an equivalent
      // in them (or if every business is being searched).
      rnt: { applies: all || Boolean(def?.rnt?.length), values: def?.rnt ?? [] },
      secop: { applies: all || Boolean(def?.secop?.length), values: def?.secop ?? [] },
      reps: { applies: !custom && (all || Boolean(def?.reps)), values: [] },
    },
  };
}
