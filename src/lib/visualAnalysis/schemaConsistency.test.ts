import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGE_KINDS, VISIBLE_ELEMENT_CATEGORIES } from './vocabularies';

describe('Visual Schema Consistency', () => {
  it('should have matching enums between TypeScript and JSON Schema', () => {
    const schemaPath = path.resolve(process.cwd(), 'schemas/visual-analysis.v0.1.0-draft.1.schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    // Check Image Kinds
    const schemaImageKinds = schema.properties.visualInfo.properties.imageKind.enum;
    assert.deepEqual(schemaImageKinds.sort(), [...IMAGE_KINDS].sort(), "Image kinds enum mismatch");

    // Check Visible Element Categories
    const schemaCategories = schema.properties.visualInfo.properties.visibleElements.items.properties.category.enum;
    assert.deepEqual(schemaCategories.sort(), [...VISIBLE_ELEMENT_CATEGORIES].sort(), "Element categories enum mismatch");
  });
});
