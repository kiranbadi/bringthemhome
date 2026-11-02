import { DOCUMENT, TitleCasePipe } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { MissingPersonDetail } from '../models/missing-person-detail.model';
import { casePath } from '../models/case-url';
import { personLocation, PERSON_PLACEHOLDER } from '../models/missing-person-display';
export const SITE_ORIGIN = new InjectionToken<string>('Public website origin', {
  providedIn: 'root',
  factory: () => new URL(inject(DOCUMENT).baseURI).origin,
});
const DEFAULT_TITLE = 'Bring Them Home | Missing Persons';
const DEFAULT_DESCRIPTION =
  'Search public missing person cases, share information, and connect families with community support.';
@Injectable({ providedIn: 'root' })
export class CaseSeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly origin = inject(SITE_ORIGIN);
  private readonly titleCase = new TitleCasePipe();
  private readonly social = [
    "property='og:title'",
    "property='og:description'",
    "property='og:url'",
    "property='og:type'",
    "property='og:site_name'",
    "property='og:image'",
    "property='og:image:alt'",
    "name='twitter:card'",
    "name='twitter:title'",
    "name='twitter:description'",
    "name='twitter:image'",
  ];
  update(record: MissingPersonDetail, image: string): void {
    const name = this.titleCase.transform(
      record.summary?.fullName ||
        record.full_name ||
        record._source?.full_name ||
        'Name not provided',
    );
    const place = record.summary?.lastKnownLocation || personLocation(record);
    const description = Array.from(
      `Public missing person case information for ${name}${place !== 'Location unavailable' ? ` in ${place}` : ''}. View details and share information with the reporting agency.`,
    )
      .slice(0, 160)
      .join('');
    const url = new URL(casePath(record), this.origin).href;
    const title = `${name} | Missing Person Case | Bring Them Home`;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: 'index,follow' });
    for (const [property, content] of Object.entries({
      'og:title': title,
      'og:description': description,
      'og:url': url,
      'og:type': 'article',
      'og:site_name': 'Bring Them Home',
    }))
      this.meta.updateTag({ property, content });
    const shareImage =
      image !== PERSON_PLACEHOLDER && /^(https?:\/\/|\/(?!\/))/.test(image)
        ? new URL(image, this.origin).href
        : null;
    for (const [key, content] of Object.entries({
      'twitter:card': shareImage ? 'summary_large_image' : 'summary',
      'twitter:title': title,
      'twitter:description': description,
    }))
      this.meta.updateTag({ name: key, content });
    for (const selector of [
      "property='og:image'",
      "property='og:image:alt'",
      "name='twitter:image'",
    ])
      this.meta.removeTag(selector);
    if (shareImage) {
      const photoUrl = shareImage;
      this.meta.updateTag({ property: 'og:image', content: photoUrl });
      this.meta.updateTag({ property: 'og:image:alt', content: `Photo of ${name}` });
      this.meta.updateTag({ name: 'twitter:image', content: photoUrl });
    }
    this.document.querySelectorAll('link[rel="canonical"]').forEach((element) => element.remove());
    const canonical = this.document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = url;
    canonical.setAttribute('data-case-seo', 'true');
    this.document.head.appendChild(canonical);
    this.document.getElementById('case-structured-data')?.remove();
    const script = this.document.createElement('script');
    script.id = 'case-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': url,
          url,
          name: title,
          description,
          about: { '@type': 'Person', name },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Missing persons',
              item: new URL('/missing-persons', this.origin).href,
            },
            { '@type': 'ListItem', position: 2, name, item: url },
          ],
        },
      ],
    }).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }
  unavailable(): void {
    this.clear();
    this.title.setTitle('Case unavailable | Bring Them Home');
    this.meta.updateTag({ name: 'robots', content: 'noindex,follow' });
  }
  clear(): void {
    this.title.setTitle(DEFAULT_TITLE);
    this.meta.updateTag({ name: 'description', content: DEFAULT_DESCRIPTION });
    this.meta.removeTag("name='robots'");
    this.social.forEach((selector) => this.meta.removeTag(selector));
    this.document.querySelectorAll('link[data-case-seo]').forEach((element) => element.remove());
    this.document.getElementById('case-structured-data')?.remove();
  }
}
