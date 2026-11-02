import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { casePath } from './app/core/models/case-url';
const app = express();
const engine = new AngularNodeAppEngine();
const browser = resolve(dirname(fileURLToPath(import.meta.url)), '../browser');
app.use(express.static(browser, { maxAge: '1y', index: false, redirect: false }));
app.use(async (req, res, next) => {
  try {
    let caseRecord;
    let caseStatus: number | undefined;
    const match = /^\/missing-persons\/(?:[^/]+\/)?([^/]+)\/?$/.exec(req.path);
    if (match && !['search', 'discussions'].includes(match[1])) {
      const id = decodeURIComponent(match[1]);
      try {
        const response = await fetch(
          `${process.env['API_ORIGIN'] || 'http://localhost:8000'}/api/v1/missing-persons/${encodeURIComponent(id)}`,
          { signal: AbortSignal.timeout(10000) },
        );
        caseStatus = response.status;
        if (response.ok) {
          caseRecord = await response.json();
          const canonical = casePath(caseRecord);
          if (canonical !== req.path) {
            res.redirect(
              301,
              canonical + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
            );
            return;
          }
        }
      } catch {
        caseStatus = 503;
      }
    }
    const response = await engine.handle(req, { caseRecord, caseStatus });
    if (response) await writeResponseToNodeResponse(response, res);
    else next();
  } catch (error) {
    next(error);
  }
});
if (isMainModule(import.meta.url)) app.listen(Number(process.env['PORT'] || 4000));
export const reqHandler = createNodeRequestHandler(app);
