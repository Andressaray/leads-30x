// Public API of the contact module: panel to contact a lead, status chip, templates and types.
export { ContactPanel } from "./components/ContactPanel";
export { StatusChip } from "./components/StatusChip";
export { QualityChip } from "./components/QualityChip";
export { QUALITY_NAME, CHANNEL_NAME, STATUS_NAME } from "./statuses";
export { updateTemplate, createTemplate, sendBatchToDapta, daptaStatus, listTemplates, listVariables } from "./services/contact.service";
export type { LeadQuality, Channel, ChannelWithPermission, ContactStatus, DaptaStatus, Template, DaptaBatchResult } from "./types";
