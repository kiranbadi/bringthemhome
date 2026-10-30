import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { CATEGORIES, Resource, STATUSES, coverage } from './resource.models';

@Component({
  selector: 'app-resource-card',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule],
  templateUrl: './resource-card.component.html',
  styleUrl: './resource-card.component.scss',
})
export class ResourceCardComponent {
  readonly resource = input.required<Resource>();
  readonly categories = CATEGORIES;
  readonly statuses = STATUSES;
  readonly coverage = coverage;
}
