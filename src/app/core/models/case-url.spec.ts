import { casePath } from './case-url';
describe('Canonical case URLs', () => {
  it('uses the backend canonical path while retaining the original document identity', () => {
    expect(casePath({ _id: 'case-1', canonical_path: '/missing-persons/jane-doe-nc/case-1' })).toBe(
      '/missing-persons/jane-doe-nc/case-1',
    );
  });
  it('rejects external, mismatched and traversal paths and preserves legacy IDs', () => {
    for (const path of [
      'https://evil.example',
      '//evil.example',
      '/missing-persons/jane/other',
      '/missing-persons/../case-1',
      '/missing-persons/jane/case-1?token=secret',
    ]) {
      expect(casePath({ _id: 'case-1', canonical_path: path })).toBe('/missing-persons/case-1');
    }
    expect(casePath({ _id: 'case/id' })).toBe('/missing-persons/case%2Fid');
  });
});
