# Cache & Runtime Observability Dashboard

The **Cache / Runtime** tab serves as a compact, lightweight server observability dashboard. It provides real-time insights into server-side cache performance, disk utilization, and process diagnostics without inspecting or exposing the actual contents of the cached files.

## Features

### 1. Compact Mobile Design
- **Responsive Layout**: On devices with screens narrower than `768px` (the Tailwind `md` breakpoint), the tab automatically reformats into a mobile-first layout.
- **Compact Summary Cards**: The top summary replaces wide charts with an elegant 2-column grid displaying:
  - **Hit Rate**: The aggregate cache efficiency.
  - **Hits / Misses**: Total counts of hits and misses.
  - **Disk**: Total disk usage of caches along with the entry count.
  - **Errors**: Non-zero errors highlighted in rose red.
  - **Uptime**: Server-process running time.
  - **Updated**: Timestamp of the latest stats fetch.
- **Per-Cache Compact Rows**: In place of wide tables, each cache type (e.g., directory structures, metadata, generated summaries) is presented in a space-saving card layout that fits in just one or two lines.
- **Collapsible Disclosures**: Detailed descriptions, memory/process diagnostics, and oldest/newest cache age ranges are placed inside native, tap-to-open `<details>` disclosures that are collapsed by default to minimize scrolling.

### 2. Desktop Observability
- Displays a comprehensive, high-density table detailing hits, misses, writes, error counts, entry volumes, disk footprint, and exact oldest/newest file age metadata.
- Offers a wide-grid process details card including heap configuration, process ID, and node environment.

### 3. Automatically Refreshed Stats
- **Interval**: Stats are polled automatically every **60 seconds** (`CACHE_STATS_REFRESH_INTERVAL_MS = 60_000`) while the tab is active.
- **On-Demand Refresh**: A manual refresh button is always available to immediately fetch the latest statistics.

### 4. Metrics Reset Semantics
- **Operation**: Tapping the "Reset Metrics" (or "リセット(統計)") button clears all accumulated hits, misses, writes, and errors.
- **Safety**: Resetting metrics **does not** delete actual cache files from the disk; it only resets the in-memory counter statistics.
- **Volatility**: All statistics are server-process-local. They reset automatically whenever the server container restarts or on manual metrics reset.
