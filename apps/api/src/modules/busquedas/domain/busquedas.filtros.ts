// Traduce la categoría del usuario a lo que entiende cada fuente.

import { CATEGORIAS, OSM_TODOS, esCiiuValido, normalizarClaveCategoria, parsearEtiquetaOsm } from '~config/catalogo/categorias';
import { AppError, HttpCode } from '~response/index';
import type { FiltrosBusqueda } from '~types/fuente.types';

export function resolverFiltros(p: { categoria?: string; ciiu?: string[]; osm?: string[]; incluirPersonasNaturales?: boolean }): FiltrosBusqueda {
  let clave: string | null = null;
  if (p.categoria && p.categoria.trim()) {
    clave = normalizarClaveCategoria(p.categoria);
    if (!clave) throw new AppError(HttpCode.BAD_REQUEST, `Categoría desconocida: "${p.categoria}". Consulta GET /catalogo/categorias.`);
  }
  const extraCiiu = (p.ciiu ?? []).map(String);
  const extraOsm = (p.osm ?? []).map(String);
  for (const c of extraCiiu) if (!esCiiuValido(c)) throw new AppError(HttpCode.BAD_REQUEST, `Código CIIU inválido: "${c}" (deben ser 4 dígitos).`);
  for (const t of extraOsm) if (!parsearEtiquetaOsm(t)) throw new AppError(HttpCode.BAD_REQUEST, `Etiqueta OSM inválida: "${t}" (formato clave=valor).`);

  const def = clave ? CATEGORIAS[clave] : null;
  const todos = !clave && extraCiiu.length === 0 && extraOsm.length === 0;
  const personalizada = !clave && !todos;
  const unicos = (xs: string[]) => [...new Set(xs)];

  return {
    categoria: clave,
    nombre: def ? def.nombre : todos ? 'Todos los negocios' : 'Personalizada',
    todos,
    incluirPersonasNaturales: Boolean(p.incluirPersonasNaturales),
    porFuente: {
      dane: { aplica: true, valores: unicos([...(def?.ciiu ?? []), ...extraCiiu]) },
      osm: { aplica: true, valores: todos ? OSM_TODOS : unicos([...(def?.osm ?? []), ...extraOsm]) },
      // Los registros sectoriales solo se consultan si la categoría tiene equivalente
      // en ellos (o si se buscan todos los negocios).
      rnt: { aplica: todos || Boolean(def?.rnt?.length), valores: def?.rnt ?? [] },
      secop: { aplica: todos || Boolean(def?.secop?.length), valores: def?.secop ?? [] },
      reps: { aplica: !personalizada && (todos || Boolean(def?.reps)), valores: [] },
    },
  };
}
