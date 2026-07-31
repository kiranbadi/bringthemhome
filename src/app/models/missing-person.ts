export interface MissingPerson {
  readonly id: number;
  readonly fullName: string;
  readonly zipcode: string;
  readonly city: string;
  readonly state: string;
  readonly lastSeenDate: string;
  readonly photos: readonly string[];
}

export interface MediaAsset {
  readonly title: string;
  readonly url: string;
  readonly type: 'photo' | 'video';
}

export interface SocialProfile {
  readonly platform: string;
  readonly handle: string;
  readonly profileUrl: string;
  readonly notes: string;
}

export interface EducationRecord {
  readonly schoolName: string;
  readonly schoolDistrict: string;
  readonly gradeLevel: string;
  readonly educationStatus: string;
  readonly dateRange: string;
  readonly schoolContacts: string;
  readonly notes: string;
}

export interface PossibleSighting {
  readonly date: string;
  readonly time: string;
  readonly locationName: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly reportedBy: string;
  readonly notes: string;
}

export interface MissingPersonDetail extends MissingPerson {
  readonly reportNumber: string;
  readonly status: string;
  readonly nickname: string;
  readonly dateOfBirth: string;
  readonly ageWhenMissing: string;
  readonly currentAge: string;
  readonly gender: string;
  readonly sexAtBirth: string;
  readonly raceEthnicity: string;
  readonly height: string;
  readonly weight: string;
  readonly hairColor: string;
  readonly eyeColor: string;
  readonly complexion: string;
  readonly languages: string;
  readonly scarsMarksTattoos: string;
  readonly medicalConditions: string;
  readonly medications: string;
  readonly disabilities: string;
  readonly otherIdentifiers: string;
  readonly lastSeenTime: string;
  readonly lastSeenLocation: string;
  readonly country: string;
  readonly lastSeenLatitude: string;
  readonly lastSeenLongitude: string;
  readonly clothing: string;
  readonly accessories: string;
  readonly circumstances: string;
  readonly possibleDestination: string;
  readonly transportation: string;
  readonly companions: string;
  readonly lawEnforcementAgency: string;
  readonly caseNumber: string;
  readonly officerName: string;
  readonly officerPhone: string;
  readonly reporterRelationship: string;
  readonly reporterName: string;
  readonly reporterPhone: string;
  readonly reporterEmail: string;
  readonly urgentSafetyNotes: string;
  readonly videos: readonly MediaAsset[];
  readonly socialProfiles: readonly SocialProfile[];
  readonly educationHistory: readonly EducationRecord[];
  readonly employmentHistory: {
    readonly currentEmployer: string;
    readonly jobTitle: string;
    readonly workLocation: string;
    readonly workSchedule: string;
    readonly supervisorContact: string;
    readonly previousEmployers: string;
    readonly employmentNotes: string;
  };
  readonly possibleSightings: readonly PossibleSighting[];
}

export interface MissingPersonSearchCriteria {
  readonly query: string;
  readonly fullName: string;
  readonly zipcode: string;
  readonly city: string;
  readonly state: string;
}

export interface MissingPersonPage {
  readonly items: readonly MissingPerson[];
  readonly total: number;
}
