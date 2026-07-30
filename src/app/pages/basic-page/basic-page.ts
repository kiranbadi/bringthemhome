import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-basic-page',
  imports: [MatCardModule],
  templateUrl: './basic-page.html',
  styleUrl: './basic-page.scss',
})
export class BasicPage {
  readonly title = input.required<string>();
}
