import { describe, it } from 'node:test';
import assert from 'node:assert';
import { landscapeFixture, receiptFixture, documentNoTextFixture } from '../__fixtures__/publicSampleVisualFixtures';
import { validateVisualAnalysis } from '../validate';

describe('Public Sample Visual Fixtures', () => {
  it('landscape fixture is valid', () => {
    const res = validateVisualAnalysis(landscapeFixture);
    assert.equal(res.isValid, true);
  });

  it('receipt fixture is valid', () => {
    const res = validateVisualAnalysis(receiptFixture);
    assert.equal(res.isValid, true);
  });

  it('document with no text fixture is valid', () => {
    const res = validateVisualAnalysis(documentNoTextFixture);
    assert.equal(res.isValid, true);
  });
});
