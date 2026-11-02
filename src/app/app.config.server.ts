import { ApplicationConfig, REQUEST, inject } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { SITE_ORIGIN } from './core/seo/case-seo.service';
export const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      withRoutes([
        { path: 'missing-persons/:id/discussions', renderMode: RenderMode.Client },
        { path: 'missing-persons/:slug/:id', renderMode: RenderMode.Server },
        { path: 'missing-persons/:id', renderMode: RenderMode.Server },
        { path: '**', renderMode: RenderMode.Client },
      ]),
    ),
    {
      provide: SITE_ORIGIN,
      useFactory: () => process.env['PUBLIC_SITE_ORIGIN'] || new URL(inject(REQUEST)!.url).origin,
    },
  ],
};
