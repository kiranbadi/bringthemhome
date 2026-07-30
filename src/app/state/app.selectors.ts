import { createFeatureSelector, createSelector } from '@ngrx/store';

import { appFeatureKey, AppState } from './app.reducer';

export const selectAppState = createFeatureSelector<AppState>(appFeatureKey);

export const selectHomecomingsMarked = createSelector(
  selectAppState,
  (state) => state.homecomingsMarked,
);
