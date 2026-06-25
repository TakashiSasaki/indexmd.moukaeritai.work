import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateVisualAnalysis } from '../validate';
import { evaluateVisualAnalysisQuality } from '../qualityGate';
import * as fixtures from './visualFixtures';

describe('Visual Fixtures Verification', () => {
  it('should validate and pass quality for landscape fixture', () => {
    const val = validateVisualAnalysis(fixtures.LANDSCAPE_FIXTURE);
    assert.strictEqual(val.isValid, true, `Landscape validation failed: ${val.errors.join(', ')}`);
    
    const qual = evaluateVisualAnalysisQuality(fixtures.LANDSCAPE_FIXTURE);
    assert.strictEqual(qual.status, "valid");
    assert.ok(!qual.issues.some(i => i.code === "NO_LANDSCAPE_ELEMENTS"));
  });

  it('should validate and pass quality for product fixture', () => {
    const val = validateVisualAnalysis(fixtures.PRODUCT_FIXTURE);
    assert.strictEqual(val.isValid, true, `Product validation failed: ${val.errors.join(', ')}`);
    
    const qual = evaluateVisualAnalysisQuality(fixtures.PRODUCT_FIXTURE);
    assert.strictEqual(qual.status, "valid");
    assert.ok(!qual.issues.some(i => i.code === "NO_PRODUCT_ELEMENTS"));
  });

  it('should validate and pass quality for document fixture', () => {
    const val = validateVisualAnalysis(fixtures.DOCUMENT_FIXTURE);
    assert.strictEqual(val.isValid, true, `Document validation failed: ${val.errors.join(', ')}`);
    
    const qual = evaluateVisualAnalysisQuality(fixtures.DOCUMENT_FIXTURE);
    assert.strictEqual(qual.status, "valid");
    assert.ok(!qual.issues.some(i => i.code === "NO_VISIBLE_TEXT_IN_DOCUMENT"));
  });

  it('should validate and pass quality for screenshot fixture', () => {
    const val = validateVisualAnalysis(fixtures.SCREENSHOT_FIXTURE);
    assert.strictEqual(val.isValid, true, `Screenshot validation failed: ${val.errors.join(', ')}`);
    
    const qual = evaluateVisualAnalysisQuality(fixtures.SCREENSHOT_FIXTURE);
    assert.strictEqual(qual.status, "valid");
    assert.ok(!qual.issues.some(i => i.code === "NO_UI_ELEMENTS"));
  });
});
