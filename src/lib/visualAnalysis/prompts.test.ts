import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildVisualAnalysisSystemInstruction, buildVisualAnalysisTaskPrompt } from './prompts';

describe('prompts', () => {
  it('should include correct instructions', () => {
    const sys = buildVisualAnalysisSystemInstruction();
    assert.ok(sys.includes("visual indexing"));
    assert.ok(sys.includes("not an ordinary document summarization"));

    const task = buildVisualAnalysisTaskPrompt(false);
    assert.ok(task.includes("imageKind"));
    assert.ok(task.includes("visibleElements"));
    assert.ok(task.includes("Landscape Photo"));
    assert.ok(task.includes("Document Photo"));

    const taskJson = buildVisualAnalysisTaskPrompt(true);
    assert.ok(taskJson.includes("visual-analysis.v0.1.0-draft.1"));
  });

  it('should include people safety instructions', () => {
    const task = buildVisualAnalysisTaskPrompt(false);
    assert.ok(task.includes("do not identify people"));
    assert.ok(task.includes("sensitive attributes"));
    assert.ok(task.includes("Describe only visible non-sensitive elements"));
  });
});
