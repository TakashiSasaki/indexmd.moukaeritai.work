import test, { describe } from 'node:test';
import assert from 'node:assert';
import { APP_TABS, VALID_TAB_IDS, isValidTabId, resolveActiveTab } from './appTabs';

describe('appTabs', () => {
  test('APP_TABS has all required tabs', () => {
    assert.strictEqual(APP_TABS.length, 8);
    assert.ok(APP_TABS.find(t => t.id === 'dashboard'));
    assert.ok(APP_TABS.find(t => t.id === 'debugger'));
    assert.ok(APP_TABS.find(t => t.id === 'summary-debugger'));
    assert.ok(APP_TABS.find(t => t.id === 'firestore-test'));
    assert.ok(APP_TABS.find(t => t.id === 'logs'));
    assert.ok(APP_TABS.find(t => t.id === 'summary-browser'));
    assert.ok(APP_TABS.find(t => t.id === 'cache-stats'));
    assert.ok(APP_TABS.find(t => t.id === 'icon-test'));
  });

  test('VALID_TAB_IDS has all ids', () => {
    assert.strictEqual(VALID_TAB_IDS.length, 8);
    assert.ok(VALID_TAB_IDS.includes('dashboard'));
  });

  test('isValidTabId returns true for valid tabs', () => {
    assert.strictEqual(isValidTabId('dashboard'), true);
  });

  test('isValidTabId returns false for invalid tabs', () => {
    assert.strictEqual(isValidTabId('invalid-tab'), false);
    assert.strictEqual(isValidTabId(''), false);
  });

  test('No duplicate tab IDs', () => {
    const ids = new Set(VALID_TAB_IDS);
    assert.strictEqual(ids.size, VALID_TAB_IDS.length);
  });

  test('resolveActiveTab resolves paths correctly', () => {
    assert.strictEqual(resolveActiveTab('/dashboard'), 'dashboard');
    assert.strictEqual(resolveActiveTab('/summary-debugger'), 'summary-debugger');
    assert.strictEqual(resolveActiveTab('dashboard'), 'dashboard'); // without slash
    assert.strictEqual(resolveActiveTab('/'), 'dashboard'); // fallback
    assert.strictEqual(resolveActiveTab('/unknown'), 'dashboard'); // fallback
    assert.strictEqual(resolveActiveTab(''), 'dashboard'); // fallback
  });
});
