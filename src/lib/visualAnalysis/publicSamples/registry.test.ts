import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAllPublicSamples } from './registry';

describe('Public Visual Sample Registry', () => {
  it('all sample IDs should be unique', () => {
    const samples = getAllPublicSamples();
    const ids = new Set();
    for (const sample of samples) {
      assert.ok(!ids.has(sample.id), `Duplicate ID found: ${sample.id}`);
      ids.add(sample.id);
    }
  });

  it('every sample has license metadata', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      assert.ok(sample.source.licenseKind, `Missing licenseKind for ${sample.id}`);
      assert.ok(sample.source.licenseName, `Missing licenseName for ${sample.id}`);
      assert.notEqual(sample.source.licenseKind, 'unknown', `License kind is unknown for ${sample.id}`);
    }
  });

  it('no sample has NC or ND licenses', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      const name = sample.source.licenseName;
      assert.ok(!name.includes('NC') && !name.includes('NonCommercial'), `NC license found for ${sample.id}`);
      assert.ok(!name.includes('ND') && !name.includes('NoDerivatives'), `ND license found for ${sample.id}`);
    }
  });

  it('every CC BY / CC BY-SA sample has attributionText', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      if (['ccBy', 'ccBySa'].includes(sample.source.licenseKind)) {
        assert.ok(sample.source.attributionText, `Missing attribution for CC BY/SA sample ${sample.id}`);
      }
    }
  });

  it('every external sample has source page URL and image URL', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      if (sample.source.provider !== 'localFixture') {
        assert.ok(sample.source.pageUrl, `Missing page URL for ${sample.id}`);
        assert.ok(sample.source.imageUrl, `Missing image URL for ${sample.id}`);
      }
    }
  });

  it('every synthetic sample references a local public asset', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      if (sample.source.provider === 'localFixture') {
        assert.ok(sample.source.imageUrl?.startsWith('/visual-samples/'), `Local fixture image URL should start with /visual-samples/ for ${sample.id}`);
      }
    }
  });

  it('every sample has a non-empty title', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      assert.ok(sample.title && sample.title.trim().length > 0, `Missing or empty title for ${sample.id}`);
    }
  });

  it('every sample has expectedImageKind and expectedElementCategories', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      assert.ok(sample.expectedImageKind, `Missing expectedImageKind for ${sample.id}`);
      assert.ok(sample.expectedElementCategories && sample.expectedElementCategories.length > 0, `Missing expectedElementCategories for ${sample.id}`);
    }
  });

  it('expected labels are non-empty where applicable', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      if (sample.expectedVisibleElementLabels !== undefined) {
        assert.ok(Array.isArray(sample.expectedVisibleElementLabels), `expectedVisibleElementLabels must be an array for ${sample.id}`);
        assert.ok(sample.expectedVisibleElementLabels.length > 0, `expectedVisibleElementLabels cannot be empty if provided for ${sample.id}`);
      }
    }
  });

  it('expected visible text is an array when present', () => {
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      if (sample.expectedVisibleText !== undefined) {
        assert.ok(Array.isArray(sample.expectedVisibleText), `expectedVisibleText must be an array for ${sample.id}`);
      }
    }
  });

  it('every external sample uses HTTPS and an allowlisted host', () => {
    const ALLOWED_HOSTS = [
      "upload.wikimedia.org",
      "commons.wikimedia.org"
    ];
    const samples = getAllPublicSamples();
    for (const sample of samples) {
      if (sample.source.provider !== 'localFixture') {
        assert.ok(sample.source.pageUrl?.startsWith('https://'), `pageUrl must use HTTPS for ${sample.id}`);
        assert.ok(sample.source.imageUrl?.startsWith('https://'), `imageUrl must use HTTPS for ${sample.id}`);
        if (sample.source.thumbnailUrl) {
            assert.ok(sample.source.thumbnailUrl.startsWith('https://'), `thumbnailUrl must use HTTPS for ${sample.id}`);
        }
        
        try {
            const parsedImage = new URL(sample.source.imageUrl!);
            assert.ok(ALLOWED_HOSTS.includes(parsedImage.hostname), `imageUrl hostname ${parsedImage.hostname} is not allowlisted for ${sample.id}`);
        } catch (e) {
            assert.fail(`Invalid imageUrl for ${sample.id}: ${e}`);
        }
      }
    }
  });

  it('calibrates sample-plant-1 and sample-person-1 accurately', () => {
    const samples = getAllPublicSamples();
    const plantSample = samples.find(s => s.id === "sample-plant-1");
    assert.ok(plantSample);
    assert.deepEqual(plantSample.expectedElementCategories, ["plant"]);
    assert.deepEqual(plantSample.expectedVisibleElementLabels, ["sunflower", "petals", "leaves"]);
    assert.deepEqual(plantSample.optionalElementCategories, ["weatherOrSky"]);
    assert.deepEqual(plantSample.optionalVisibleElementLabels, ["sky"]);

    const personSample = samples.find(s => s.id === "sample-person-1");
    assert.ok(personSample);
    assert.strictEqual(personSample.expectedImageKind, "artifactPhoto");
    assert.deepEqual(personSample.expectedElementCategories, ["person", "clothing", "symbol"]);
    assert.deepEqual(personSample.expectedVisibleElementLabels, ["woman", "garment", "meander border"]);
    assert.deepEqual(personSample.optionalElementCategories, ["container"]);
    assert.deepEqual(personSample.optionalVisibleElementLabels, ["vase surface", "scroll"]);
  });
});
