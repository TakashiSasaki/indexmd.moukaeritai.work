## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.

## 2024-06-27 - [Expensive array operations inside JSX render loop]
**Learning:** It's easy to accidentally perform expensive array operations (like `filter`, `flatMap`, and `Set`) directly inside render logic when using inline IIFEs (`(() => {...})()`) in JSX. This causes unnecessary overhead on every state change.
**Action:** Extract and memoize expensive filter/map/set operations with `useMemo` outside the render loop.
