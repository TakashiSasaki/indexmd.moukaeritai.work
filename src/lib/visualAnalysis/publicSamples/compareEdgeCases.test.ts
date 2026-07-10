import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compareExpectedImageKind, compareExpectedLabels } from './compare';
import { PUBLIC_VISUAL_SAMPLES } from './registry';

describe('public sample comparison edge cases', () => {
  it('accepts artifactPhoto for the antique furniture sample only through sample metadata', () => {
    const sample = PUBLIC_VISUAL_SAMPLES.find(s => s.id === 'sample-furniture-1')!;
    const result = compareExpectedImageKind(sample, 'artifactPhoto');
    assert.strictEqual(result.status, 'acceptable');
  });

  it('normalizes cloud/clouds/cloudy concept without broad stemming', () => {
    const result = compareExpectedLabels({
      expectedVisibleElementLabels: ['clouds'],
      expectedVisibleElementLabelAliases: { clouds: ['cloud', 'clouds', 'cloudy', 'partly cloudy'] }
    }, { labels: [], attributes: ['partly cloudy'], keywords: [], visibleText: [] });
    assert.deepStrictEqual(result.missing, []);
    assert.deepStrictEqual(result.acceptable, ['clouds']);
  });

  it('does not let a single adjective satisfy a multi-token noun-phrase alias on attributes', () => {
    const result = compareExpectedLabels({
      expectedVisibleElementLabels: ['petals'],
      expectedVisibleElementLabelAliases: { petals: ['yellow petals'] }
    }, { labels: [], attributes: ['yellow'], keywords: [], visibleText: [] });
    assert.deepStrictEqual(result.acceptable, []);
    assert.deepStrictEqual(result.missing, ['petals']);
  });
});
