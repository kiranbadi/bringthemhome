import { Component, EventEmitter, Input, Output, forwardRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MissingPersonDetail } from '../models/missing-person';
import { MissingPersonsService } from '../services/missing-persons';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

type DetailMediaItem =
  | {
      readonly type: 'photo';
      readonly url: string;
      readonly title: string;
    }
  | {
      readonly type: 'video';
      readonly url: string;
      readonly title: string;
    };

type ShareChannel = {
  readonly label: string;
  readonly icon: string;
  readonly url: (shareUrl: string, text: string) => string;
};

type TipUpload = {
  readonly name: string;
  readonly size: string;
  readonly type: string;
};

type TipPayload = {
  readonly missingPerson: {
    readonly id: number;
    readonly reportNumber: string;
    readonly fullName: string;
  };
  readonly tipster: {
    readonly fullName: string;
    readonly email: string;
    readonly phone: string;
    readonly relationship: string;
  };
  readonly sighting: {
    readonly date: string;
    readonly time: string;
    readonly location: string;
    readonly city: string;
    readonly state: string;
    readonly latitude: string;
    readonly longitude: string;
  };
  readonly comment: string;
  readonly attachments: {
    readonly photos: readonly TipUpload[];
    readonly videos: readonly TipUpload[];
  };
};

@Component({
  selector: 'app-person-detail',
  imports: [
    MatButtonModule,
    MatIconModule,
    NavigationHeader,
    RouterLink,
    forwardRef(() => TipSubmissionDialog),
  ],
  templateUrl: './person-detail.html',
  styleUrl: './person-detail.scss',
})
export class PersonDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly missingPersonsService = inject(MissingPersonsService);

  protected readonly person = this.missingPersonsService.getById(
    Number(this.route.snapshot.paramMap.get('id')),
  );

  protected activeMediaIndex = 0;
  protected posterMessage = '';
  protected tipResponseMessage = '';
  protected tipDialogOpen = false;

  protected readonly shareChannels: readonly ShareChannel[] = [
    {
      label: 'Facebook',
      icon: 'facebook',
      url: (shareUrl) =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'X',
      icon: 'alternate_email',
      url: (shareUrl, text) =>
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
    },
    {
      label: 'LinkedIn',
      icon: 'business',
      url: (shareUrl) =>
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'WhatsApp',
      icon: 'chat',
      url: (shareUrl, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`,
    },
    {
      label: 'Reddit',
      icon: 'forum',
      url: (shareUrl, text) =>
        `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(text)}`,
    },
    {
      label: 'Telegram',
      icon: 'send',
      url: (shareUrl, text) =>
        `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
    },
    {
      label: 'Email',
      icon: 'mail',
      url: (shareUrl, text) =>
        `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'SMS',
      icon: 'sms',
      url: (shareUrl, text) => `sms:?&body=${encodeURIComponent(`${text} ${shareUrl}`)}`,
    },
  ];

  protected mediaItems(person: MissingPersonDetail): readonly DetailMediaItem[] {
    return [
      ...person.photos.map((url, index) => ({
        type: 'photo' as const,
        url,
        title: `Photo ${index + 1}`,
      })),
      ...person.videos.map((video) => ({
        type: 'video' as const,
        url: video.url,
        title: video.title,
      })),
    ];
  }

  protected activeMedia(person: MissingPersonDetail): DetailMediaItem {
    return this.mediaItems(person)[this.activeMediaIndex] ?? this.mediaItems(person)[0];
  }

  protected selectMedia(index: number): void {
    this.activeMediaIndex = index;
  }

  protected previousMedia(person: MissingPersonDetail): void {
    const mediaCount = this.mediaItems(person).length;
    this.activeMediaIndex =
      this.activeMediaIndex === 0 ? mediaCount - 1 : this.activeMediaIndex - 1;
  }

  protected nextMedia(person: MissingPersonDetail): void {
    const mediaCount = this.mediaItems(person).length;
    this.activeMediaIndex =
      this.activeMediaIndex === mediaCount - 1 ? 0 : this.activeMediaIndex + 1;
  }

  protected shareUrl(person: MissingPersonDetail): string {
    return `${window.location.origin}/missing-person/${person.id}`;
  }

  protected shareText(person: MissingPersonDetail): string {
    return `Help find ${person.fullName}. Last seen in ${person.city}, ${person.state}.`;
  }

  protected sharePerson(person: MissingPersonDetail, channel: ShareChannel): void {
    window.open(channel.url(this.shareUrl(person), this.shareText(person)), '_blank', 'noopener');
  }

  protected async copyShareLink(person: MissingPersonDetail): Promise<void> {
    await navigator.clipboard.writeText(this.shareUrl(person));
    this.posterMessage = `Share link copied for ${person.fullName}.`;
  }

  protected openTipDialog(): void {
    this.tipDialogOpen = true;
  }

  protected closeTipDialog(): void {
    this.tipDialogOpen = false;
  }

  protected handleTipSubmitted(payload: TipPayload): void {
    console.log('Missing person tip payload', JSON.stringify(payload, null, 2));
    this.tipDialogOpen = false;
    this.tipResponseMessage = `Thank you. Your tip for ${payload.missingPerson.fullName} has been submitted for review.`;
  }

  protected createPoster(person: MissingPersonDetail): void {
    const posterPayload = {
      reportNumber: person.reportNumber,
      fullName: person.fullName,
      status: person.status,
      photo: person.photos[0],
      lastSeen: {
        date: person.lastSeenDate,
        time: person.lastSeenTime,
        location: person.lastSeenLocation,
        city: person.city,
        state: person.state,
      },
      physicalDescription: {
        ageWhenMissing: person.ageWhenMissing,
        currentAge: person.currentAge,
        height: person.height,
        weight: person.weight,
        hairColor: person.hairColor,
        eyeColor: person.eyeColor,
      },
      tipUrl: `/contact-us?personId=${person.id}&type=tip`,
    };

    console.log('Missing person poster payload', posterPayload);
    this.posterMessage = `Poster payload ready for ${person.fullName}.`;
  }
}

@Component({
  selector: 'app-tip-submission-dialog',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <div class="tip-modal-backdrop" role="presentation" (click)="closed.emit()">
      <section
        class="tip-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tip-dialog-title"
        (click)="$event.stopPropagation()"
      >
        <header class="tip-modal-header">
          <h2 id="tip-dialog-title">Submit a Tip</h2>
          <button matIconButton type="button" (click)="closed.emit()" aria-label="Close tip form">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        </header>
        <p class="dialog-intro">
          Share what you know about {{ person.fullName }}. Include photos or video if they help
          explain the sighting.
        </p>

        <form class="tip-form" [formGroup]="tipForm">
          <section class="dialog-section">
            <h3>Your Details</h3>
            <div class="dialog-field-grid">
              <mat-form-field appearance="outline">
                <mat-label>Full Name</mat-label>
                <input matInput formControlName="fullName" autocomplete="name" />
                @if (tipForm.controls.fullName.hasError('required')) {
                  <mat-error>Full name is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="email" />
                @if (tipForm.controls.email.hasError('required')) {
                  <mat-error>Email is required.</mat-error>
                } @else if (tipForm.controls.email.hasError('email')) {
                  <mat-error>Enter a valid email.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" inputmode="tel" autocomplete="tel" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Relationship</mat-label>
                <input matInput formControlName="relationship" />
              </mat-form-field>
            </div>
          </section>

          <section class="dialog-section">
            <h3>Tip Details</h3>
            <div class="dialog-field-grid">
              <mat-form-field appearance="outline">
                <mat-label>Sighting Date</mat-label>
                <input matInput type="date" formControlName="sightingDate" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sighting Time</mat-label>
                <input matInput type="time" formControlName="sightingTime" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Location</mat-label>
                <input matInput formControlName="location" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City</mat-label>
                <input matInput formControlName="city" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>State</mat-label>
                <input matInput formControlName="state" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Latitude</mat-label>
                <input matInput formControlName="latitude" inputmode="decimal" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Longitude</mat-label>
                <input matInput formControlName="longitude" inputmode="decimal" />
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Comments</mat-label>
              <textarea matInput formControlName="comment" rows="5"></textarea>
              @if (tipForm.controls.comment.hasError('required')) {
                <mat-error>Comment is required.</mat-error>
              }
            </mat-form-field>
          </section>

          <section class="dialog-section">
            <h3>Attachments</h3>
            <div class="upload-row">
              <label class="dialog-upload">
                <input type="file" accept="image/*" multiple (change)="addPhotos($event)" />
                <mat-icon aria-hidden="true">add_photo_alternate</mat-icon>
                <span>Add Photos</span>
              </label>
              <label class="dialog-upload">
                <input type="file" accept="video/*" multiple (change)="addVideos($event)" />
                <mat-icon aria-hidden="true">video_call</mat-icon>
                <span>Add Videos</span>
              </label>
            </div>

            @if (photoFiles.length > 0 || videoFiles.length > 0) {
              <ul class="dialog-file-list" aria-label="Selected tip attachments">
                @for (file of photoFiles; track file.name + $index) {
                  <li>
                    <span>{{ file.name }}</span
                    ><small>{{ file.size }}</small>
                  </li>
                }
                @for (file of videoFiles; track file.name + $index) {
                  <li>
                    <span>{{ file.name }}</span
                    ><small>{{ file.size }}</small>
                  </li>
                }
              </ul>
            }
          </section>
        </form>
        <footer class="tip-modal-actions">
          <button matButton type="button" (click)="closed.emit()">Cancel</button>
          <button matButton="filled" type="button" (click)="submit()">Submit Tip</button>
        </footer>
      </section>
    </div>
  `,
  styles: `
    .tip-modal-backdrop {
      align-items: start;
      background: color-mix(in srgb, var(--mat-sys-scrim) 46%, transparent);
      bottom: 0;
      display: grid;
      justify-items: center;
      left: 0;
      overflow: auto;
      padding: 32px 16px;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 1000;
    }

    .tip-modal {
      background: var(--mat-sys-surface);
      border-radius: 8px;
      box-shadow: var(--mat-sys-level3);
      box-sizing: border-box;
      max-width: 760px;
      padding: 18px;
      width: min(760px, 100%);
    }

    .tip-modal-header,
    .tip-modal-actions {
      align-items: center;
      display: flex;
      gap: 10px;
      justify-content: space-between;
    }

    .tip-modal-header {
      margin-bottom: 12px;
    }

    .tip-modal-header h2 {
      font: var(--mat-sys-title-large);
      margin: 0;
    }

    .tip-modal-actions {
      justify-content: flex-end;
      margin-top: 4px;
    }

    .dialog-intro {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 14px;
    }

    .tip-form,
    .dialog-section {
      display: grid;
      gap: 12px;
    }

    .dialog-section {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      margin-bottom: 12px;
      padding: 12px;
    }

    .dialog-section h3 {
      font: var(--mat-sys-title-medium);
      margin: 0;
    }

    .dialog-field-grid,
    .upload-row {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .dialog-upload {
      align-items: center;
      background: var(--mat-sys-surface-container-low);
      border: 1px dashed var(--mat-sys-outline);
      border-radius: 8px;
      cursor: pointer;
      display: grid;
      gap: 6px;
      min-height: 86px;
      place-items: center;
      text-align: center;
    }

    .dialog-upload input {
      height: 0;
      opacity: 0;
      position: absolute;
      width: 0;
    }

    .dialog-file-list {
      display: grid;
      gap: 6px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .dialog-file-list li {
      align-items: center;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      display: flex;
      gap: 10px;
      justify-content: space-between;
      padding: 8px 10px;
    }

    .dialog-file-list span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dialog-file-list small {
      color: var(--mat-sys-on-surface-variant);
      flex: 0 0 auto;
    }

    @media (max-width: 640px) {
      .dialog-field-grid,
      .upload-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TipSubmissionDialog {
  @Input({ required: true }) person!: MissingPersonDetail;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly submittedTip = new EventEmitter<TipPayload>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly photoFiles: TipUpload[] = [];
  protected readonly videoFiles: TipUpload[] = [];

  protected readonly tipForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    relationship: [''],
    sightingDate: [''],
    sightingTime: [''],
    location: [''],
    city: [''],
    state: [''],
    latitude: [''],
    longitude: [''],
    comment: ['', Validators.required],
  });

  protected addPhotos(event: Event): void {
    this.addFiles(event, this.photoFiles, 'image/');
  }

  protected addVideos(event: Event): void {
    this.addFiles(event, this.videoFiles, 'video/');
  }

  protected submit(): void {
    this.tipForm.markAllAsTouched();

    if (this.tipForm.invalid) {
      return;
    }

    const formValue = this.tipForm.getRawValue();
    const payload: TipPayload = {
      missingPerson: {
        id: this.person.id,
        reportNumber: this.person.reportNumber,
        fullName: this.person.fullName,
      },
      tipster: {
        fullName: formValue.fullName,
        email: formValue.email,
        phone: formValue.phone,
        relationship: formValue.relationship,
      },
      sighting: {
        date: formValue.sightingDate,
        time: formValue.sightingTime,
        location: formValue.location,
        city: formValue.city,
        state: formValue.state,
        latitude: formValue.latitude,
        longitude: formValue.longitude,
      },
      comment: formValue.comment,
      attachments: {
        photos: this.photoFiles,
        videos: this.videoFiles,
      },
    };

    this.submittedTip.emit(payload);
  }

  private addFiles(event: Event, collection: TipUpload[], typePrefix: string): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith(typePrefix));

    collection.push(
      ...files.map((file) => ({
        name: file.name,
        size: this.formatFileSize(file.size),
        type: file.type || 'Unknown',
      })),
    );

    input.value = '';
  }

  private formatFileSize(size: number): string {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
}
