## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.

## 2025-03-08 - Optimized O(N log N) sorting to O(N) pass for React component DriveDashboard
**Learning:** Found a highly inefficient sorting algorithm `[...allFoldersForStats].sort((a,b) => ...)` running on thousands of items inside a `useMemo` that evaluates every time a file sync event happens, allocating and calling `new Date()` multiple times per comparison. Since only the first (unvisited) and oldest items are needed, this can be done in O(N).
**Action:** Replace `Array.sort` with a single O(N) loop whenever trying to find just the max/min elements of a list, especially inside render or useMemo cycles that run often with large amounts of data.
