import React from 'react';
import { test, describe, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SavedSummariesBrowser } from '../../../src/components/SavedSummariesBrowser';

const mockSummaries = [
  { id: '1', summary: 'Apple description', file_name: 'Apple', title: 'Apple', structured: {} },
  { id: '2', summary: 'Banana text', file_name: 'Banana', title: 'Banana', structured: {} }
];

import { setMockFirestoreDocuments, resetMockFirestoreDocuments } from '../../support/mocks/firebase';
import { act } from '@testing-library/react';

vi.mock('../../../src/lib/firebase', async (importOriginal) => {
  const mod = await import('../../support/mocks/firebase');
  return mod;
});

describe('SavedSummariesBrowser Debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    setMockFirestoreDocuments([
      {
        id: "summary-apple",
        data: {
          file_name: "Apple",
          title: "Apple",
          summary: "Apple summary text",
          structured: {}
        }
      },
      {
        id: "summary-banana",
        data: {
          file_name: "Banana",
          title: "Banana",
          summary: "Banana summary text",
          structured: {}
        }
      }
    ]);
  });

  afterEach(() => {
    resetMockFirestoreDocuments();
    vi.clearAllMocks();
    cleanup();
    vi.useRealTimers();
  });

  test('typed text appears in the input immediately, filtering is delayed', async () => {
    render(
      <SavedSummariesBrowser
        userId="test-user"
        token={null}
        dirs={[]}
      />
    );

    // Wait for the mocked Firestore promise and React state update to complete
    await act(async () => {
      await Promise.resolve(); // let microtasks process first so getDocs resolves
    });

    // Flush the rest of the effect timers just in case
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const searchInput = screen.getByPlaceholderText(/ファイル名、要約内容、モデル.../i) as HTMLInputElement;
    expect(searchInput).toBeDefined();

    // By checking for elements with the title we use the existing structure
    expect(screen.getAllByText(/Apple/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Banana/i).length).toBeGreaterThan(0);

    // Type "Apple"
    fireEvent.change(searchInput, { target: { value: 'Apple' } });

    // Value updates immediately
    expect(searchInput.value).toBe('Apple');

    act(() => {
      vi.advanceTimersByTime(299);
    });

    // After typing, timer hasn't elapsed, so debounce hasn't triggered.
    // So Banana is still visible in the DOM
    expect(screen.getAllByText(/Banana/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Apple/i).length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Now it should filter out Banana
    expect(screen.queryByText(/Banana summary text/i)).toBeNull();
    expect(screen.getAllByText(/Apple/i).length).toBeGreaterThan(0);

    // Type rapidly
    fireEvent.change(searchInput, { target: { value: 'B' } });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.change(searchInput, { target: { value: 'Banana' } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The final filtering result must correspond only to "Banana"
    expect(screen.queryByText(/Apple summary text/i)).toBeNull();
    expect(screen.getAllByText(/Banana/i).length).toBeGreaterThan(0);
  });

  test('debounce is cleaned up on unmount', async () => {
    const view = render(
      <SavedSummariesBrowser
        userId="test-user"
        token={null}
        dirs={[]}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const searchInput = screen.getByPlaceholderText(/ファイル名、要約内容、モデル.../i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Apple' } });

    // Unmount before timer finishes
    view.unmount();

    // Advance timers, should not error or attempt to set state on unmounted component
    act(() => {
      vi.runOnlyPendingTimers();
    });
    // Verified by lack of "Can't perform a React state update on an unmounted component" warning
  });
});
