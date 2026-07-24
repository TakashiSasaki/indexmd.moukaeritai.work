## 2024-03-24 - Pre-calculate nested filters
**Learning:** Found an O(N^2) array scan via `.filter()` inside a loop that goes over `sortedDirs` during the index generation bottom-up pass in `DriveDashboard.tsx`. Because `filteredDirs` could potentially contain hundreds or thousands of directories, the nested filter lookup for `parent_id` is an exponential chokepoint on the main render thread.
**Action:** When finding a `.filter()` condition nested inside another traversal or `.map()`, pre-calculate the data into a grouped `Map` (like a dictionary grouped by ID) for an O(1) lookup to bring the overall complexity down to O(N).
## 2024-07-12 - Date parsing inside JS sort comparator
**Learning:** Found a performance bottleneck where `sortSavedSummariesByGeneratedAt` in `src/lib/savedSummaryBrowser.ts` repeatedly parsed ISO date strings (`new Date(str).getTime()`) inside a `.sort()` comparator loop, resulting in $O(N \log N)$ date conversions.
**Action:** Use the Schwartzian transform (map-sort-map) to convert string dates to timestamps only once per item ($O(N)$), saving significant CPU cycles.
## 2024-07-24 - Pre-calculate dictionary to avoid O(N) `.find()` in loops
**Learning:** Found an $O(N \times D)$ bottleneck where `dirs.find()` was used to repeatedly look up the parent directory ID inside a `while` loop that climbs the directory tree (path depth $D$). Because the `.find()` method does a full array scan each time, this degraded performance linearly with the number of directories and tree depth on the main render thread.
**Action:** When finding a `.find()` lookup inside a traversal loop, replace it with a pre-calculated dictionary (e.g., `Map<string, Directory>`) to achieve $O(1)$ lookups, lowering total time complexity from $O(N \times D)$ down to $O(D)$.
