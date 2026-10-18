import { qualityFromScore, normalizeDaptaResult } from 'modules/qualifications/domain/qualifications.webhook';
import { AppError } from '~response/index';

describe('normalizeDaptaResult', () => {
  it('accepts Spanish field names', () => {
    expect(
      normalizeDaptaResult({ referencia: 'r1', calificacion: 'Alta', puntaje: '88', resumen: 'Le interesa', variables: { demo: true }, llamada_id: 'c1' })
    ).toEqual({ reference: 'r1', leadId: undefined, quality: 'HIGH', score: 88, summary: 'Le interesa', variables: { demo: true }, callId: 'c1', noContact: false });
  });

  it('accepts English field names and infers the quality from the score', () => {
    expect(normalizeDaptaResult({ reference: 'r2', score: 45, call_summary: 'Tal vez', call_id: 991 })).toMatchObject({
      reference: 'r2', quality: 'MEDIUM', score: 45, summary: 'Tal vez', callId: '991',
    });
    expect(normalizeDaptaResult({ lead: { id: '7' }, qualification: 'cold' })).toMatchObject({ leadId: 7, quality: 'LOW' });
    expect(normalizeDaptaResult({ lead_id: 7, calidad: 'no aplica' }).quality).toBe('DISCARDED');
    expect(normalizeDaptaResult({ lead_id: 7, quality: 'high' }).quality).toBe('HIGH');
  });

  it('no quality and a failed call status → no contact', () => {
    expect(normalizeDaptaResult({ reference: 'r', call_status: 'no_answer' }).noContact).toBe(true);
    expect(normalizeDaptaResult({ referencia: 'r', estado_llamada: 'Buzón de voz' }).noContact).toBe(true);
    expect(normalizeDaptaResult({ reference: 'r', call_status: 'completed' }).noContact).toBe(false);
  });

  it.each([
    [{}, 'reference'],
    [{ reference: 'r', quality: 'superbien' }, 'desconocida'],
    [{ reference: 'r', score: 140 }, '0 a 100'],
    [{ reference: 'r', score: 'abc' }, '0 a 100'],
  ])('rejects %j', (body, text) => {
    expect(() => normalizeDaptaResult(body)).toThrow(AppError);
    expect(() => normalizeDaptaResult(body)).toThrow(text);
  });

  it('qualityFromScore: ≥70 high, ≥40 medium, otherwise low', () => {
    expect([100, 70, 69, 40, 39, 0].map(qualityFromScore)).toEqual(['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'LOW', 'LOW']);
  });
});
