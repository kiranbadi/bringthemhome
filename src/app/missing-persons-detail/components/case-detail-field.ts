import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { displayValue } from '../case-profile-format';

@Component({
  selector: 'app-case-detail-field',
  template: `<dl>
    <dt>{{ label() }}</dt>
    <dd>
      @if (href()) {
        <a [href]="href()">{{ display(value()) }}</a>
      } @else {
        {{ display(value()) }}
      }
    </dd>
  </dl>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    dl {
      margin: 0;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      margin-bottom: 4px;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
      white-space: pre-line;
      line-height: 1.6;
    }
    a {
      color: var(--mat-sys-primary);
    }
    a:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 3px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetailField {
  readonly label = input.required<string>();
  readonly value = input<unknown>();
  readonly href = input<string | null>(null);
  protected readonly display = displayValue;
}
