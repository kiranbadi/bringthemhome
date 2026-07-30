export interface MissingPerson {
  readonly id: number;
  readonly fullName: string;
  readonly zipcode: string;
  readonly city: string;
  readonly state: string;
  readonly lastSeenDate: string;
  readonly photos: readonly string[];
}

export interface MissingPersonSearchCriteria {
  readonly fullName: string;
  readonly zipcode: string;
  readonly city: string;
  readonly state: string;
}

export interface MissingPersonPage {
  readonly items: readonly MissingPerson[];
  readonly total: number;
}
