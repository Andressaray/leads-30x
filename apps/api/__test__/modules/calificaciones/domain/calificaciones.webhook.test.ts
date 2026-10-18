import { calidadDePuntaje, normalizarResultadoDapta } from 'modules/calificaciones/domain/calificaciones.webhook';
import { AppError } from '~response/index';

describe('normalizarResultadoDapta', () => {
  it('acepta nombres en español', () => {
    expect(
      normalizarResultadoDapta({ referencia: 'r1', calificacion: 'Alta', puntaje: '88', resumen: 'Le interesa', variables: { demo: true }, llamada_id: 'c1' })
    ).toEqual({ referencia: 'r1', leadId: undefined, calidad: 'ALTA', puntaje: 88, resumen: 'Le interesa', variables: { demo: true }, llamadaId: 'c1', sinContacto: false });
  });

  it('acepta nombres en inglés y deduce la calidad del puntaje', () => {
    expect(normalizarResultadoDapta({ reference: 'r2', score: 45, call_summary: 'Tal vez', call_id: 991 })).toMatchObject({
      referencia: 'r2', calidad: 'MEDIA', puntaje: 45, resumen: 'Tal vez', llamadaId: '991',
    });
    expect(normalizarResultadoDapta({ lead: { id: '7' }, qualification: 'cold' })).toMatchObject({ leadId: 7, calidad: 'BAJA' });
    expect(normalizarResultadoDapta({ lead_id: 7, calidad: 'no aplica' }).calidad).toBe('DESCARTADO');
  });

  it('sin calificación y con estado de llamada fallida → sin contacto', () => {
    expect(normalizarResultadoDapta({ referencia: 'r', call_status: 'no_answer' }).sinContacto).toBe(true);
    expect(normalizarResultadoDapta({ referencia: 'r', estado_llamada: 'Buzón de voz' }).sinContacto).toBe(true);
    expect(normalizarResultadoDapta({ referencia: 'r', call_status: 'completed' }).sinContacto).toBe(false);
  });

  it.each([
    [{}, 'referencia'],
    [{ referencia: 'r', calificacion: 'superbien' }, 'desconocida'],
    [{ referencia: 'r', puntaje: 140 }, '0 a 100'],
    [{ referencia: 'r', puntaje: 'abc' }, '0 a 100'],
  ])('rechaza %j', (body, texto) => {
    expect(() => normalizarResultadoDapta(body)).toThrow(AppError);
    expect(() => normalizarResultadoDapta(body)).toThrow(texto);
  });

  it('calidadDePuntaje: ≥70 alta, ≥40 media, si no baja', () => {
    expect([100, 70, 69, 40, 39, 0].map(calidadDePuntaje)).toEqual(['ALTA', 'ALTA', 'MEDIA', 'MEDIA', 'BAJA', 'BAJA']);
  });
});
