import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiError } from './natural-search.models';
import { VOICE_INPUT, VoiceInput } from './voice-input';
export { VOICE_INPUT } from './voice-input';
export type { VoiceInput } from './voice-input';
export type { ApiError, SearchPayload, SearchResultItem } from './natural-search.models';

@Component({
  selector: 'app-natural-search-hero',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './natural-search-hero.component.html',
  styleUrl: './natural-search-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturalSearchHeroComponent {
  readonly busy = input(false);
  readonly apiError = input<ApiError | null>(null);
  readonly retrySearch = output<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  private readonly createVoice = inject(VOICE_INPUT);
  private readonly zone = inject(NgZone);
  private voice?: VoiceInput;
  readonly voiceSupported = this.createVoice !== null;
  readonly listening = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    query: [
      '',
      [
        Validators.required,
        Validators.maxLength(500),
        (control) => (control.value.trim() ? null : { required: true }),
      ],
    ],
  });
  @ViewChild('queryInput') private queryInput?: ElementRef<HTMLInputElement>;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.stopVoice();
      this.form.controls.query.setValue(params.get('nl_query') ?? '', { emitEvent: false });
    });
    inject(DestroyRef).onDestroy(() => this.stopVoice());
    effect(() => {
      const error = this.apiError();
      if (!error) return;
      if (error.status === 400 || error.status === 422) {
        this.form.controls.query.setErrors({ ...this.form.controls.query.errors, server: true });
        this.form.controls.query.markAsTouched();
      }
      if (error.status === 429) this.snack.open(error.message, 'Dismiss', { duration: 8000 });
    });
  }
  submit(): void {
    if (this.busy()) return;
    this.stopVoice();
    this.form.controls.query.updateValueAndValidity({ emitEvent: false });
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.queryInput?.nativeElement.focus();
      return;
    }
    void this.router.navigate(['/missing-persons'], {
      queryParams: {
        nl_query: this.form.controls.query.value.trim(),
        nl_mode: 'semantic',
        page: 1,
      },
    });
  }
  clear(): void {
    this.stopVoice();
    this.form.controls.query.setValue('');
    this.queryInput?.nativeElement.focus();
  }
  toggleVoice(): void {
    if (this.busy()) return;
    if (this.listening()) {
      this.stopVoice();
      return;
    }
    if (!this.createVoice) {
      this.snack.open(
        'Voice search is unavailable in this browser. Please type your search.',
        'Dismiss',
        { duration: 6000 },
      );
      return;
    }
    this.stopVoice();
    try {
      const voice = this.createVoice();
      this.voice = voice;
      voice.onresult = (text) =>
        this.zone.run(() => {
          if (this.voice !== voice) return;
          this.form.controls.query.setValue(text);
          this.queryInput?.nativeElement.focus();
        });
      voice.onend = () =>
        this.zone.run(() => {
          if (this.voice === voice) this.listening.set(false);
        });
      voice.onerror = () =>
        this.zone.run(() => {
          if (this.voice !== voice || !this.listening()) return;
          this.listening.set(false);
          this.snack.open(
            'Could not use the microphone. Check permission or type your search.',
            'Dismiss',
            { duration: 6000 },
          );
        });
      this.listening.set(true);
      voice.start();
    } catch {
      this.stopVoice();
      this.snack.open('Voice search could not start. Please type your search.', 'Dismiss', {
        duration: 6000,
      });
    }
  }
  private stopVoice(): void {
    const voice = this.voice;
    this.voice = undefined;
    this.listening.set(false);
    if (voice) {
      voice.onresult = null;
      voice.onerror = null;
      voice.onend = null;
      voice.abort();
    }
  }
}
