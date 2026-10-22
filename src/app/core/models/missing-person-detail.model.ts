import { EmbeddedImages, MissingPerson } from './missing-person.model';

// Direct representation of the supplied detail response; no cross-source normalization.
export interface CaseLocation {
  location?: string | null;
  address?: string | null;
  intersection?: string | null;
  generalLocation?: string | null;
  coordinates?: { latitude?: number | null; longitude?: number | null } | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  missingFromTribalLand?: boolean | null;
  primaryResidenceOnTribalLand?: boolean | null;
}

export interface PublicAgency {
  agencyName?: string | null;
  agencyPhone?: string | null;
  agencyEmail?: string | null;
  agencyAddress?: string | null;
  agencyCaseNumber?: string | null;
  dateReported?: string | null;
  notes?: string | null;
}

export interface MissingPersonDetail extends Partial<MissingPerson> {
  _id: string;
  source?: string | null;
  caseNumber?: string | null;
  caseStatus?: string | null;
  lastUpdated?: string | null;
  _source?: {
    full_name?: string | null;
    missing_since?: string | null;
    reported_at?: string | null;
    created_at?: string | null;
    image_urls?: string[];
    embedded_images?: EmbeddedImages;
    photo_url?: string | null;
  };
  summary?: {
    fullName?: string | null;
    primaryImageUrl?: string | null;
    dateReported?: string | null;
    lastKnownLocation?: string | null;
    reportingAgency?: string | null;
  };
  demographics?: {
    missingAge?: number | null;
    currentAge?: number | null;
    dateOfBirth?: string | null;
    legalFirstName?: string | null;
    middleName?: string | null;
    legalLastName?: string | null;
    chosenNamesNicknamesAliases?: string[];
    biologicalSex?: string | null;
    heightInches?: number | null;
    weight?: { value?: number | null; unit?: string | null } | null;
    raceEthnicity?: string[];
  };
  circumstances?: {
    dateOfLastContact?: string | null;
    namusCaseCreated?: string | null;
    lastKnownLocation?: CaseLocation | null;
    circumstancesOfDisappearance?: string | null;
  };
  physicalDescription?: {
    hairColor?: string | null;
    headHairDescription?: string | null;
    bodyHairDescription?: string | null;
    facialHairDescription?: string | null;
    leftEyeColor?: string | null;
    rightEyeColor?: string | null;
    eyeDescription?: string | null;
    wearsPrescriptionGlasses?: boolean | null;
    distinctivePhysicalFeatures?: unknown[];
  };
  // Empty sample arrays do not define item properties. Render clothing/vehicles as
  // read-only structured values; never assume unconfirmed media/contact schemas.
  clothingAndAccessories?: { items?: unknown[]; additionalNotes?: string | null };
  transportation?: { vehicles?: unknown[]; transportationNotes?: string[] };
  imagesAndDocuments?: { images?: unknown[]; documents?: unknown[] };
  contacts?: {
    investigatingAgencies?: PublicAgency[];
    namusCaseNumber?: string | null;
    ncmecCaseNumber?: string | null;
    additionalPublicContacts?: unknown[];
  };
}
