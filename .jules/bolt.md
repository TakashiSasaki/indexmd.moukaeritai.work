## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.

## 2024-05-18 - [Optimizing O(N) array finds in loops with Maps]
**Learning:** Found multiple instances where `array.filter` or `array.find` were called inside a loop over another array, causing $O(N^2)$ or $O(N \times D)$ time complexities. This is especially prevalent when establishing hierarchical parent-child relationships (like rendering tree paths or grouping children).
**Action:** When a loop involves looking up items in another array by an ID (e.g., `parent_id` or `drive_id`), pre-calculate a `Map` structure mapping the IDs to the objects (or arrays of objects) before the loop. This converts the inner $O(N)$ lookup to an $O(1)$ lookup, bringing the overall time complexity down to $O(N)$. Use `useMemo` for static maps during renders.
