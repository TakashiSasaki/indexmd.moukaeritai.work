## 2024-06-25 - [O(M*N) nested filter inside render loop]
**Learning:** Found an `O(M*N)` performance bottleneck where an `array.filter` was used inside an `array.map` in a React component's render function, resulting in poor performance as data scales up.
**Action:** When evaluating arrays within a component loop, avoid nested array iterations such as `.filter()`. Pre-calculate data into hash maps grouping the items using `useMemo` so mapping loops get an `O(1)` constant time lookup.
## 2025-03-05 - Lazy Loading Heavy UI Tabs
**Learning:** Statically importing heavily conditionally rendered UI tabs (like SummaryDebugger and SavedSummariesBrowser) inflates the initial bundle size and negatively impacts TTI (Time to Interactive). Since they are large, the main chunk size exceeded Vite's warning threshold.
**Action:** Always consider using `React.lazy()` and `Suspense` for large route components or conditionally rendered tabs that are not needed on initial load. This simple optimization saved ~260KB in the main chunk.
