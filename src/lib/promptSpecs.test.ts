import { test } from 'node:test';
import assert from 'node:assert';
import { buildSummaryDebugSystemInstruction } from './promptSpecs';
import {
  DOCUMENT_KINDS,
  SUBJECT_DOMAINS,
  SUBJECT_LABEL_KINDS,
  KEYWORD_SOURCES,
  TEMPORAL_ROLE_CATEGORIES,
  PARTY_ROLE_CATEGORIES,
  MONETARY_ROLE_CATEGORIES
} from "./summaryAnalysis/vocabularies";

test('buildSummaryDebugSystemInstruction', async (t) => {
  const prompt = buildSummaryDebugSystemInstruction();

  await t.test('prompt does not list invalid document kinds', () => {
    assert.ok(!prompt.includes('"article"'));
    assert.ok(!prompt.includes('"agreement"'));
    assert.ok(!prompt.includes('"presentation"'));
    assert.ok(!prompt.includes('"financialStatement"'));
  });

  await t.test('prompt does not list invalid subject domains', () => {
    assert.ok(!prompt.includes('"health"'));
    assert.ok(!prompt.includes('"science"'));
    assert.ok(!prompt.includes('"governance"'));
  });

  await t.test('prompt does not list invalid role categories', () => {
    assert.ok(!prompt.includes('"legal"'));
    assert.ok(!prompt.includes('"academic"'));
    assert.ok(!prompt.includes('"reference"'));
  });

  await t.test('prompt includes exact source token embeddedMetadata', () => {
    assert.ok(prompt.includes('"embeddedMetadata"'));
  });

  await t.test('prompt includes mapping examples', () => {
    assert.ok(prompt.includes('dataset'));
    assert.ok(prompt.includes('DO NOT use "spreadsheet"'));
  });
});
