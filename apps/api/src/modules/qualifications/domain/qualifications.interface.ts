import type { SessionUser } from '~types/auth.types';
import type {
  QualificationDTO,
  QualifyManuallyDTO,
  DaptaStatusDTO,
  BatchSendResultDTO,
} from '../types/qualifications.types';

export interface QualificationsDomainInterface {
  /** How the integration is configured (for the web app). */
  status(): DaptaStatusDTO;
  /** Qualification history of a lead (404 if it does not exist). */
  list(leadId: number): Promise<QualificationDTO[]>;
  /**
   * Sends a lead to Dapta. 409 if they asked not to be contacted, if someone else works it or if it is
   * already in Dapta waiting for a result; 422 if it has no phone or Ley 2300 does not allow calling it
   * now (when Dapta calls); 502 if Dapta does not receive it; 503 if the integration is disabled.
   */
  send(leadId: number, user: SessionUser): Promise<QualificationDTO>;
  /** Sends several leads; the ones that cannot be sent are skipped with their reason. */
  sendBatch(leadIds: number[], user: SessionUser): Promise<BatchSendResultDTO>;
  /** Result sent by the Dapta flow. 401 with an invalid secret; 404 if the dispatch is not found. */
  receiveResult(body: Record<string, unknown>, secret: string | undefined): Promise<QualificationDTO>;
  /** Manual qualification (whoever works the lead or an ADMIN). */
  qualifyManually(leadId: number, dto: QualifyManuallyDTO, user: SessionUser): Promise<QualificationDTO>;
}
