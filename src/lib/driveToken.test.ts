import { test } from "node:test";
import assert from "node:assert";
import { 
  saveDriveTokenState, 
  loadDriveTokenState, 
  clearDriveTokenState, 
  isDriveTokenLikelyExpired,
  getDriveAuthHeaders
} from "./driveToken.js";

// We mock sessionStorage for node tests
global.sessionStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] || null; },
  setItem(key: string, value: string) { this.store[key] = value; },
  removeItem(key: string) { delete this.store[key]; },
  clear() { this.store = {}; },
  length: 0,
  key(index: number) { return Object.keys(this.store)[index] || null; }
} as unknown as Storage;

// We mock localStorage for node tests
global.localStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] || null; },
  setItem(key: string, value: string) { this.store[key] = value; },
  removeItem(key: string) { delete this.store[key]; },
  clear() { this.store = {}; },
  length: 0,
  key(index: number) { return Object.keys(this.store)[index] || null; }
} as unknown as Storage;

test("Drive token state lifecycle", () => {
  sessionStorage.clear();
  localStorage.setItem("drive_access_token", "old_token");

  // Save
  const state = saveDriveTokenState("test_token_123");
  assert.strictEqual(state.accessToken, "test_token_123");
  assert.ok(state.expiresAt > state.acquiredAt);

  // localStorage cleanup
  assert.strictEqual(localStorage.getItem("drive_access_token"), null);

  // Load
  const loaded = loadDriveTokenState();
  assert.ok(loaded);
  assert.strictEqual(loaded.accessToken, "test_token_123");

  // Expiration check
  assert.strictEqual(isDriveTokenLikelyExpired(loaded), false);

  // Clear
  clearDriveTokenState();
  assert.strictEqual(loadDriveTokenState(), null);
});

test("Drive token state expiration", () => {
  sessionStorage.clear();
  const state = saveDriveTokenState("test_token_123");
  
  // Simulate expired token
  state.expiresAt = Date.now() - 1000;
  sessionStorage.setItem("drive_token_state", JSON.stringify(state));

  // Should return null and clear state if expired
  const loaded = loadDriveTokenState();
  assert.strictEqual(loaded, null);
  assert.strictEqual(sessionStorage.getItem("drive_token_state"), null);
});

test("Drive token handles malformed JSON without throwing", () => {
  sessionStorage.clear();
  sessionStorage.setItem("drive_token_state", "invalid{json");

  assert.doesNotThrow(() => {
    const loaded = loadDriveTokenState();
    assert.strictEqual(loaded, null);
  });
});

test("Drive token missing item", () => {
  sessionStorage.clear();
  const loaded = loadDriveTokenState();
  assert.strictEqual(loaded, null);
});

test("isDriveTokenLikelyExpired handles null", () => {
  assert.strictEqual(isDriveTokenLikelyExpired(null), true);
});

test("getDriveAuthHeaders returns correctly formatted headers", () => {
  const headers = getDriveAuthHeaders("test-token");
  assert.strictEqual(headers["Authorization"], "Bearer test-token");
  assert.strictEqual(headers["x-google-drive-token"], "test-token");
});
