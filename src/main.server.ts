import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { serverConfig } from './app/app.config.server';
export default (context: BootstrapContext) =>
  bootstrapApplication(App, mergeApplicationConfig(appConfig, serverConfig), context);
