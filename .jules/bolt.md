## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.
## 2026-07-02 - O(n²) loop optimization for hierarchy traversals
**Learning:** During folder index generation, filtering child directories inside a loop over all directories causes an O(n²) bottleneck. In large nested Drive structures, this nested iteration severely degrades performance.
**Action:** Pre-calculate child directories using a Map grouped by parent ID before iterating. This converts the O(n²) nested search into an O(n) iteration with O(1) lookups.
