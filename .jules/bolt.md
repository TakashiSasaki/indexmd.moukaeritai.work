## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.

## 2024-07-06 - [O(N^2) Array Iteration inside O(N) Processing Loop]
**Learning:** Found an `O(N^2)` bottleneck inside an asynchronous processing loop (`handleStartIndex` in `DriveDashboard.tsx`) where `filteredDirs.filter(...)` was being called inside a loop running over `sortedDirs` (derived from `filteredDirs`). As directory counts scale into the thousands, this can block the main thread or severely degrade indexing initialization times.
**Action:** Always pre-calculate relations using a Hash Map outside the loop to change the lookup complexity to `O(1)`, improving the overall algorithmic time complexity from `O(N^2)` to `O(N)`.
