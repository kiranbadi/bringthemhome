import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { displayValue } from '../case-profile-format';

@Component({
  selector: 'app-case-record',
  template: `@if (rows().length) {
      <dl>
        @for (row of rows(); track row[0]) {
          <div>
            <dt>{{ label(row[0]) }}</dt>
            <dd><app-case-record [value]="row[1]" /></dd>
          </div>
        }
      </dl>
    } @else if (items(); as list) {
      <ul>
        @for (item of list; track $index) {
          <li><app-case-record [value]="item" /></li>
        }
      </ul>
    } @else {
      <span>{{ display(value()) }}</span>
    }`,
  styles: `
    :host {
      display: block;
      min-width: 0;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    dl,
    dd {
      margin: 0;
    }
    dl {
      display: grid;
      gap: 12px;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    li + li {
      margin-top: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseRecord {
  readonly value = input<unknown>();
  protected readonly display = displayValue;
  protected readonly label = (key: string) =>
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/^./, (value) => value.toUpperCase());
  protected readonly items = computed(() =>
    Array.isArray(this.value()) && (this.value() as unknown[]).length
      ? (this.value() as unknown[])
      : null,
  );
  protected readonly rows = computed(() => {
    const value = this.value();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).filter(
          ([key]) => !['isPublic', 'private', 'restricted', 'isRestricted'].includes(key),
        )
      : [];
  });
}
