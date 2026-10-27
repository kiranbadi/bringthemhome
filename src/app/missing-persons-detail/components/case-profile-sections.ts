import { formatLocation, stateName } from '../../core/models/us-state-display';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MissingPersonDetail } from '../../core/models/missing-person-detail.model';
import { PERSON_PLACEHOLDER } from '../../core/models/missing-person-display';
import {
  currentAge,
  isPublicCaseMedia,
  isPublicCaseRecord,
  emailLink,
  locationMapUrl,
  phoneLink,
  publicImageUrl,
} from '../case-profile-format';
import { CaseDetailField } from './case-detail-field';
import { CaseRecord } from './case-record';

@Component({
  selector: 'app-case-profile-sections',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatIconModule,
    CaseDetailField,
    CaseRecord,
  ],
  templateUrl: './case-profile-sections.html',
  styleUrl: './case-profile-sections.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseProfileSections {
  protected readonly formatLocation = formatLocation;
  protected readonly stateName = stateName;
  readonly record = input.required<MissingPersonDetail>();
  private readonly dialog = inject(MatDialog);
  @ViewChild('imagePreview') private imagePreview!: TemplateRef<{ $implicit: string }>;
  protected readonly age = computed(() => currentAge(this.record()));
  protected readonly mapUrl = computed(
    () =>
      locationMapUrl(this.record().circumstances?.lastKnownLocation) ||
      locationMapUrl({
        location: this.record().summary?.lastKnownLocation || this.record().location,
        city: this.record().city,
        state: this.record().state,
      }),
  );
  protected readonly phoneLink = phoneLink;
  protected readonly emailLink = emailLink;
  protected readonly placeholder = PERSON_PLACEHOLDER;
  protected readonly failedImages = signal(new Set<string>());
  protected readonly images = computed(() => {
    const record = this.record();
    const candidates = [
      record.summary?.primaryImageUrl,
      ...(record.embedded_images?.data_urls ?? []),
      ...(record._source?.embedded_images?.data_urls ?? []),
      ...(record._source?.image_urls ?? []),
      record._source?.photo_url,
      ...(record.imagesAndDocuments?.images ?? [])
        .filter(isPublicCaseMedia)
        .map((image) => image.url),
    ];
    return [...new Set(candidates.map(publicImageUrl).filter((url): url is string => !!url))];
  });
  protected readonly publicContacts = computed(() =>
    (this.record().contacts?.additionalPublicContacts ?? []).filter(isPublicCaseRecord),
  );
  protected readonly documents = computed(() =>
    (this.record().imagesAndDocuments?.documents ?? []).filter(isPublicCaseMedia),
  );
  protected readonly height = computed(() => {
    const inches = this.record().demographics?.heightInches;
    if (typeof inches !== 'number' || !Number.isFinite(inches) || inches < 0)
      return this.record().height;
    return `${Math.floor(inches / 12)}′ ${inches % 12}″ (${inches} inches)`;
  });
  protected readonly weight = computed(() => {
    const weight = this.record().demographics?.weight;
    return weight?.value != null
      ? `${weight.value} ${weight.unit?.trim() || '(unit not provided)'}`
      : this.record().weight;
  });

  protected imageFailed(url: string): void {
    this.failedImages.update((previous) => new Set(previous).add(url));
  }

  protected preview(url: string): void {
    if (!this.failedImages().has(url))
      this.dialog.open(this.imagePreview, {
        data: url,
        maxWidth: '95vw',
        width: '900px',
        autoFocus: 'first-tabbable',
      });
  }
}
