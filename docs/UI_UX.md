# UI/UX Specifications - indexmd

## 1. Aesthetic Identity
The interface follows a **"Modern Utility"** theme. It prioritizes information density and clarity over decorative elements.

- **Background**: Slate-50 (`#F8FAFC`) to provide a clean, high-contrast canvas.
- **Accents**: Indigo (`#6366F1`) for primary actions and status indicators.
- **Borders**: Slate-200 for subtle definition.

## 2. Typography
- **Primary Sans**: `Inter` (ui-sans-serif). Used for all body text, labels, and small UI elements.
- **Display Heading**: `Inter` with `tracking-tight` and `font-bold` for a professional, Swiss-style layout.
- **Monospace**: `JetBrains Mono` or `ui-monospace`. Used for status tokens (e.g., version numbers, sync status, drive IDs).

## 3. Interaction Design
- **Authenticated State**: Once logged in, the UI transitions from a "Hero/Pitch" layout to an "Action Dashboard" layout.
- **Status Indicators**:
  - `Scanned`: Grey (Pending traversal).
  - `Indexed`: Indigo (Successfully summarized).
  - `Rescan Needed`: Amber (Path changes detected).
- **Benign Error Handling**: Interactive components use fallback UI or subtle warnings for non-critical failures (like Google API token expiry) rather than breaking the entire page.

## 4. Layout Grid
- **Header**: Fixed (z-50) with blurred background/shadow for persistence.
- **Sidebar (Optional/Contextual)**: Used for settings or folder detail views.
- **Main Stage**: Centered `max-w-7xl` container representing the primary work zone.

## 5. Responsive Design Constraints (Mobile vs. Desktop)

### Mobile-Specific Design Guidelines
- **Touch Elements & Target Sizes**: All interactive targets (buttons, folder chips, lists) on mobile screens **MUST** have a minimum height/width of **44px** to allow comfortable touch access without misclicks.
- **Action Triggers & Swipe Handlers**: Avoid relying exclusively on hover-triggered tooltips or action buttons on screens below `md` breakpoint. Always render touchable icons or details inline.
- **Layout Adjustments**:
  - Convert sidebars into bottom-sheets or overlay drawers with clear "Close" triggers.
  - Wrap wide status tables in a container with horizontal scroll (`overflow-x-auto`) or transform tabular rows into cards for optimal readability.
  - Collapse complex hierarchy breadcrumbs to show only the immediate parent and the current directory instead of long nested path elements that break page margins.
- **Negative Space & Padding**: Condense structural spacing on small screens (e.g., from `py-12 px-8` on desktop to `py-4 px-4` on mobile) to maintain reasonable space for user notes preview and logs.

### Desktop-Specific Design Guidelines
- **Hover & Mouse Cursor Feedback**: All active controls must implement responsive visual hover feedback (e.g., slight color transitions `hover:bg-indigo-50`, brightness adjustments, or smooth scaling effects with Tailwind).
- **Density & Fluidity**: Utilize the full width up to `max-w-7xl`, deploying elegant bento-style sidegrids or dual-column structures (e.g., directory scan progress on the left, live process logs/history on the right) rather than stretching simple layouts endlessly.
- **Keyboard Navigation & Accessibility**:
  - Focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500`) must be highly visible.
  - Primary triggers should support key listeners (e.g., ESC to dismiss panels, Enter to activate confirm dialogs).
- **Visual Micro-animations**: Employ conservative `motion` layout animations (powered by `motion/react`) for smooth entry/exit and hover effects (e.g., folder chips sliding in when updated, batch counters incrementing smoothly).
