/** Multipart metadata contract: docs/api/online-tips.md. */
export interface SubmitTipRequest {
  missingPersonId: string;
  caseNumber?: string;
  submissionType: 'STANDARD' | 'ANONYMOUS';
  tipCategory: string;
  description: string;
  acknowledged: boolean;
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
