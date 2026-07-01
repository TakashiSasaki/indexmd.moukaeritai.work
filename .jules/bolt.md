## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.

## 2024-05-18 - [DriveDashboard and indexer.ts filter optimizations]
**Learning:** O(N^2) complexity existed when `.filter(d => d.parent_id === item.drive_id)` was called iteratively within a loop processing child directories. This was present in both `src/components/DriveDashboard.tsx` and `src/lib/drive/indexer.ts`.
**Action:** When filtering array items inside a loop against array properties (like parent IDs matching an item ID), pre-calculate a hash map grouping the child items by `parent_id` (`new Map()`) to perform lookups in O(1) time. This prevents the O(N^2) time complexity.
