import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

interface PolicySection {
  title: string;
  text: string;
}
const TERMS: readonly PolicySection[] = [
  {
    title: 'Purpose of this website',
    text: 'Bring Them Home helps people discover missing-person cases and share potentially useful information. It is not an emergency service, an official police-reporting channel, or a substitute for contacting the responsible law enforcement agency. If someone is in immediate danger, contact local emergency services.',
  },
  {
    title: 'Account information and roles',
    text: 'Provide accurate contact information and use an email address you control. Keep your password private. Select the role that honestly describes your relationship to the work. Selecting Law Enforcement Official does not verify your identity, establish agency affiliation, or grant investigative authority. If you are a minor, ask a parent or guardian to help you use this service.',
  },
  {
    title: 'Responsible reports and tips',
    text: 'Share facts you reasonably believe to be accurate, distinguish observations from assumptions, and include the case identifier when available. Do not submit knowingly false reports, impersonate another person, make threats, or use information for harassment, stalking, discrimination, or exploitation. A submission does not guarantee investigation, publication, verification, or a response.',
  },
  {
    title: 'Permission and sensitive information',
    text: 'Only submit photographs, videos, and other material you have permission or lawful authority to provide. Take particular care with children and vulnerable adults. Do not include passwords, government identification numbers, financial information, or unnecessary private contact details. Share sensitive medical or safety information directly with the responsible agency when appropriate.',
  },
  {
    title: 'Public information and personal safety',
    text: 'Case details may be incomplete, outdated, or inaccurate. Confirm a case’s current status with the listed agency before acting or resharing. Do not confront, follow, or attempt to detain anyone based on a listing. A person’s location or identity should not be treated as confirmed merely because it appears in a report or tip.',
  },
  {
    title: 'Corrections, removal, and concerns',
    text: 'Use Contact Us to request a correction, report misuse, or raise a concern about consent or exposure of personal information. Include the case identifier and the reason for your request, but avoid sending additional sensitive evidence through a general inquiry. The handling of a request may depend on verifying the relevant facts and your authority to request a change.',
  },
  {
    title: 'Interim status and updates',
    text: 'These terms are an interim draft for the current website. Operator identity, jurisdiction-specific terms, and operational procedures still require confirmation before public launch. The website’s features and these terms may change; review the latest version before submitting new information.',
  },
];
const PRIVACY: readonly PolicySection[] = [
  {
    title: 'Information you provide',
    text: 'Registration asks for your name, email Login ID, password, international phone number, chosen role, optional role description, notes, and acceptance of the policies. Contact inquiries ask for contact details, a subject, and a message. Missing-person and tip forms may also contain photographs, videos, identifying characteristics, sightings, location history, and reporter information.',
  },
  {
    title: 'Purpose and limits of collection',
    text: 'Account and contact information is intended to support account creation and responses to inquiries. Case information and tips are intended to help locate missing people and support relevant follow-up. Provide only information needed for that purpose. Registration alone does not publish your registration details in the public gallery. Some report and tip workflows are still being developed; a form’s presence does not confirm that every field is saved or shared.',
  },
  {
    title: 'Public cases and sharing',
    text: 'Information and images displayed in the gallery are visible to website visitors. Anyone may copy a public case link or reshare a case through another service. Copies outside this website may remain available after the original listing changes. Do not assume that public case information or a general contact submission is confidential.',
  },
  {
    title: 'External services and technical requests',
    text: 'The current website loads fonts and icons from Google and may display externally hosted case images or media. Those providers receive technical requests from your browser, which can include your IP address and browser information. Share actions can open external services whose privacy policies apply independently. Browser clipboard access is requested only through the sharing action.',
  },
  {
    title: 'Development diagnostics',
    text: 'The current registration flow logs the formatted registration request, including its password, to the browser developer console. Contact, report, and tip workflows may also write submitted information to the console. Use test information in this development version; these diagnostics need review before collecting real personal information in a public deployment.',
  },
  {
    title: 'Storage, retention, and access',
    text: 'Account and contact submissions are sent to the configured application API. Backend storage controls, retention periods, service providers, and access procedures have not yet been documented for this interim notice. This notice does not promise encryption at rest, automatic deletion, or a particular retention period. Those practices must be confirmed by the operator before public launch.',
  },
  {
    title: 'Children and vulnerable people',
    text: 'Missing-person cases may concern children or people facing particular safety risks. Avoid submitting unnecessary school, home, health, or family information to public fields. If you are unsure whether information should be public, contact the responsible agency first. A parent, guardian, or authorized representative can raise a privacy concern through Contact Us.',
  },
  {
    title: 'Questions and requests',
    text: 'Use Contact Us to ask about information you submitted, request correction or removal, or report a privacy concern. Include a case identifier or the email used for registration rather than additional sensitive documents. Identity verification and legal requirements may affect what can be changed or disclosed. Operator contact details and applicable privacy-rights procedures remain to be finalized.',
  },
];

@Component({
  selector: 'app-policy-page',
  standalone: true,
  imports: [NavigationHeader, RouterLink],
  templateUrl: './policy-page.component.html',
  styleUrl: './policy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyPageComponent {
  readonly policy = input<'terms' | 'privacy'>('terms');
  readonly title = computed(() =>
    this.policy() === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions',
  );
  readonly sections = computed(() => (this.policy() === 'privacy' ? PRIVACY : TERMS));
}
