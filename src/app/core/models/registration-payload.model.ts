export type RegistrationRole =
  'LAW_ENFORCEMENT' | 'GENERAL_PUBLIC' | 'RELATIVE' | 'TIP_PROVIDER' | 'OTHER';

/** Registration API request. Phone contains the international E.164 number. */
export interface RegistrationPayload {
  readonly email: string;
  readonly password: string;
  readonly phone: string;
  readonly full_name: string;
  readonly notes: string;
  readonly role: RegistrationRole;
  readonly other_role_description: string | null;
  readonly terms_accepted: boolean;
}
