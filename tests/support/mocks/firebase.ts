import { vi } from "vitest";

type MockFirestoreDocument = {
  id: string;
  data: Record<string, unknown>;
};

let documents: MockFirestoreDocument[] = [];

export function setMockFirestoreDocuments(
  nextDocuments: MockFirestoreDocument[]
): void {
  documents = structuredClone(nextDocuments);
}

export function resetMockFirestoreDocuments(): void {
  documents = [];
}

export const getDocs = vi.fn(async () => ({
  docs: documents.map(document => ({
    id: document.id,
    data: () => structuredClone(document.data)
  }))
}));

export const collection = vi.fn(() => ({ type: "mock-collection" }));
export const query = vi.fn(value => value);
export const limit = vi.fn(value => ({ type: "mock-limit", value }));
export const db = {};
