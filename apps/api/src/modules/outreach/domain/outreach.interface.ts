import type { SessionUser } from '~types/auth.types';
import type {
  SendEmailDTO,
  ContactSheetDTO,
  LeadContactDTO,
  PreparedMessageDTO,
  RecordContactDTO,
  RecordReplyDTO,
  ContactResultDTO,
  PreviewDTO,
} from '../types/outreach.types';

export interface OutreachDomainInterface {
  /** Status, history, data per channel and whether it can be contacted now (and why not). 404 if it does not exist. */
  sheet(leadId: number, user: SessionUser): Promise<ContactSheetDTO>;
  /** Fills a template (or a text) with the lead's data. 400 if it uses variables that do not exist. */
  preview(leadId: number, dto: PreviewDTO, user: SessionUser): Promise<PreparedMessageDTO>;
  /**
   * Sends an email to the lead and records it. 409 if they asked not to be contacted, said they are not interested
   * or someone else works the lead; 422 if Ley 2300 does not allow it now; 502 if SMTP rejects it.
   */
  sendEmail(leadId: number, dto: SendEmailDTO, user: SessionUser): Promise<ContactResultDTO>;
  /** Records a WhatsApp message, a call or another contact made outside the platform (same rules). */
  recordContact(leadId: number, dto: RecordContactDTO, user: SessionUser): Promise<ContactResultDTO>;
  /** Records how the lead replied. 409 if it had not been contacted yet or someone else works it. */
  recordReply(leadId: number, dto: RecordReplyDTO, user: SessionUser): Promise<ContactResultDTO>;
  /** The lead asked not to be contacted (by phone, WhatsApp…): blocks every message. */
  markDoNotContact(leadId: number, note: string | undefined, user: SessionUser): Promise<LeadContactDTO>;
  /** Public unsubscribe link of the emails. 404 if the link is not valid. */
  unsubscribe(token: string): Promise<{ name: string }>;
  /** For other modules: throws 404/409/422 if the lead cannot be contacted through that channel now. */
  requireContactPermission(leadId: number, user: SessionUser, channel: 'EMAIL' | 'WHATSAPP' | 'CALL'): Promise<LeadContactDTO>;
  /** For other modules: a call made by an external system (Dapta agent) on behalf of the user. */
  recordExternalCall(leadId: number, user: SessionUser, note: string): Promise<void>;
  /** For other modules: the lead replied to an external system. It only advances the funnel. */
  recordExternalReply(leadId: number, result: 'REPLIED' | 'INTERESTED', note: string): Promise<void>;
}
