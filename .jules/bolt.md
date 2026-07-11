## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.
## 2025-02-28 - [Memoizing DriveLogs LogItems]
**Learning:** React components that render large lists of arrays with rapidly updating state (like terminal logs) need list virtualization or at least memoization. Wrapping the `map` callback item in `React.memo` effectively drops render times for existing items from O(N) to O(1) on list append.
**Action:** When mapping over frequently updated large lists in React, wrap the rendered item in a `memo`ized component to prevent re-rendering the entire list when a single item is appended.

## 2025-03-01 - [Debouncing Heavy List Filtering Inputs]
**Learning:** Un-debounced search inputs that trigger heavy `O(N)` list filtering operations (like those inside a `useMemo`) cause noticeable typing lag and UI freezing on large datasets. React attempts to synchronously filter the list and re-render on every single keystroke.
**Action:** Always debounce text inputs that trigger list filtering in React. Introduce a local `useState` for immediate typing feedback and sync it to the actual filter dependency state via a debounced `useEffect` (e.g., using `setTimeout`).
