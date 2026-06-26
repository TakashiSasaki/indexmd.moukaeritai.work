## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.
## 2024-05-24 - Array Sorting in `useMemo` hooks
**Learning:** `useMemo` hooks in React components can become a performance bottleneck if they use expensive operations like `O(N log N)` array sorting on large datasets, especially when only a few extreme values are needed from the sorted result.
**Action:** Replace `O(N log N)` `sort()` operations with `O(N)` linear scans to find necessary extremes when the entire sorted array is not required.
