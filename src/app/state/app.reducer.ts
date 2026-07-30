import { createReducer, on } from '@ngrx/store';

import { appActions } from './app.actions';

export const appFeatureKey = 'app';

export interface AppState {
  readonly homecomingsMarked: number;
}

export const initialAppState: AppState = {
  homecomingsMarked: 0,
};

export const appReducer = createReducer(
  initialAppState,
  on(appActions.markHomecoming, (state) => ({
    ...state,
    homecomingsMarked: state.homecomingsMarked + 1,
  })),
  on(appActions.resetHomecomings, () => initialAppState),
);
