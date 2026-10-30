import { publicResourceLocation } from './resource-case-location';
import { MissingPersonDetail } from '../core/models/missing-person-detail.model';
describe('Public case resource location', () => {
  it('never passes locations without explicit public visibility', () => {
    expect(
      publicResourceLocation({
        _id: 'one',
        circumstances: {
          lastKnownLocation: { state: 'New York', county: 'New York County', city: 'New York' },
        },
      }),
    ).toEqual({});
  });
  it('passes only public last-seen geography, without addresses or coordinates', () => {
    const r = {
      _id: 'one',
      circumstances: {
        lastKnownLocation: {
          visibility: 'PUBLIC',
          state: '36',
          county: '36061',
          city: '3651000',
          address: 'Private street',
        },
      },
    } as MissingPersonDetail;
    expect(publicResourceLocation(r)).toEqual({ state: '36', county: '36061', city: '3651000' });
  });
  it('falls back to unfiltered directory for restricted locations', () => {
    const r = {
      _id: 'one',
      circumstances: { lastKnownLocation: { visibility: 'RESTRICTED', state: '36' } },
    } as MissingPersonDetail;
    expect(publicResourceLocation(r)).toEqual({});
  });
});
