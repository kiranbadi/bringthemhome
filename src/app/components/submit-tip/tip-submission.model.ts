/** Frontend draft model only. Map to a verified server contract before enabling submission. */
export interface SubmitTipRequest {
  missingPersonId: string;
  caseNumber?: string;
  submissionType: 'STANDARD' | 'ANONYMOUS';
  tipCategory: string;
  description: string;
  incidentDate?: string;
  incidentTime?: string;
  location?: string;
  additionalInformation?: string;
  confidenceLevel?: string;
  contact?: {
    fullName?: string;
    email?: string;
    phone?: string;
    preferredContactMethod?: string;
    willingToBeContacted: boolean;
  };
}
export interface SubmitTipResponse {
  referenceNumber?: string;
}
