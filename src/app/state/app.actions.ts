import { createActionGroup, emptyProps } from '@ngrx/store';

export const appActions = createActionGroup({
  source: 'App',
  events: {
    'Mark Homecoming': emptyProps(),
    'Reset Homecomings': emptyProps(),
  },
});
