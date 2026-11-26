<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Performance and loading rules (required for every change)

OrderFlow users are often on phones with slow connections. A new feature must never make a page noticeably slower to open, and every wait must show the right loading style. Check each point below before you finish a change, and say in your summary how you checked it.

## 1. Don't add waits to opening a page

- **Never ask the server who the user is just to load data or show their name.** Use `getSignedInUser(supabase)` from `src/lib/supabase.ts`. It reads the session already in the browser (no network round trip). Keep `supabase.auth.getUser()` only for actions that save or change data. Row-level security still protects every query.
- **Start independent requests together** (`Promise.all`), never one `await` after another.
- **Show the page as soon as its main data arrives.** Counts, badges, settings and other extras load in the background and fill in afterwards. See `load()` in `src/store/useFeatureRequestStore.ts`.
- **Coming back to a page must be instant.** If the store already has data, show it and refresh quietly (`{ silent: true }`). Never throw it away and show a loading state again.
- **Fetch only what the screen needs.** Name the columns in `.select(...)` (no `'*'` on new queries), add a `.limit(...)` to lists, and don't download whole tables to count rows or compute a total if the database can do it.
- **No new calls in render or on every keystroke.** Search, matching and filtering of data already loaded happen in the browser with `useMemo`.

## 2. Keep the first download small

- **Load on demand anything the user has to open:** modals, sheets, drawers, admin-only tabs, rarely used panels. Use `next/dynamic` with `{ ssr: false, loading: DotsOverlay }` (or `DotsBlock` for a tab area), and preload them just after the page appears (`setTimeout(() => import(...), 0)`). See `src/app/follow-ups/page.tsx`.
- **Only do this for components added when the user taps something** (`{open && <Modal />}`). A component that is always mounted and hidden with an `open` prop (`WhatsNewModal`, `FilterPanel`) must not get a `loading` fallback, or the dots show on every page load.
- **Don't add a new npm package** for something a few lines of code can do. If a package is really needed, note its size and load it on demand if only one screen uses it.

## 3. Use the agreed loading styles (one at a time)

Components live in `src/components/loading/`.

| Moment | Use | Rule |
|---|---|---|
| The app opens | `BootSplash` (OrderFlow logo) | Already in every signed-in layout. Add it to any **new** signed-in layout. Never on public pages (home, login, sign-up, contact, demo). |
| A page's data is loading | A skeleton from `Skeleton.tsx` | Add a skeleton that matches the new page's layout (same grid, spacing and card shapes). Never a full-page spinner. |
| Something small loading inside a page that is already shown | `LoadingDots`, `DotsBlock`, `DotsOverlay` | Only in that spot. Never at the same time as a skeleton or the logo. |
| A button is saving | The button's own "Saving…" text | Disable the button while it saves. |

- **Never show an empty state ("No orders", ₹0 totals) before the data has loaded.** Wait for the store's `initialized` / `status === 'ready'` and show the skeleton until then.
- **Every loading state must end.** On an error, show a clear message with a way to retry, never an endless skeleton or dots.

## 4. Fit every screen

- **The page must not scroll sideways at 320 px, 390 px, 768 px or 1280 px.** The `<main>` in each layout has `min-w-0`; keep it in new layouts.
- **Give flex children that hold text or inputs `min-w-0`.** Let rows wrap (`flex-wrap`) or stack on phones.
- **Full order IDs and long names wrap** (`break-all` / `break-words`); they are never cut off.
- **Long rows of chips scroll inside their own row** (`overflow-x-auto`), not the whole page.

## 5. Check it before you finish

1. Run `npx tsc --noEmit`, `npm run lint` and `npm test`. Lint must not report new problems; the current total is 16, all in files unrelated to this work.
2. Run `npx next build` and confirm every route still builds.
3. Open the changed pages with Chrome DevTools → Network → "Slow 4G", or a phone-sized window, and check:
   - First open and coming back both feel quick, with no long blank or spinner-only screen.
   - The right loading style shows, only one at a time.
   - There is no sideways scrolling at 320 px.
   - The console shows no errors.
4. If a change adds a network request to opening a page, or a new package, explain why in your summary and give before/after timings.
