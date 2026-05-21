
## Plan: Add "Recent Announcements" + "Market Trends" side panels on the Comparison page

### What gets built

On the **Comparison** tab of `AnalysisResults`, add a right-hand rail with two stacked cards:

1. **Recent Announcements & Launches** — competitor/product news (product launches, feature releases, funding, partnerships, exec moves) for each competitor in the analysis, grouped by company, each item with title, date, source link, and a 1-line "why it matters" highlight.
2. **Market Trends** — industry-level signals for the user's company–product space (emerging tech, shifting buyer behavior, analyst takes, regulatory moves), each rendered as a trend card with a short narrative + supporting source links.

Layout on the Comparison tab becomes:
```text
[ Comparison table .................. ][ Announcements ]
[ ................................... ][ Market trends ]
```
On narrow screens the rail stacks under the table.

Each card shows: a "Last refreshed" timestamp, a small **Refresh** button (per card), and skeletons while loading. Empty/error states are handled inline.

### Where the data comes from

A new edge function **`market-intel`** generates both feeds:

- **Announcements**: Firecrawl `search` per competitor (queries like `"<company> <product> launch OR announcement OR release"`, time-filtered `tbs: qdr:m`), then Gemini (`google/gemini-2.5-flash`) condenses each result into `{ company, title, date, url, highlight }`.
- **Market trends**: Firecrawl `search` on industry-level queries derived from `user_company` + `user_product` + analysis categories (e.g. `"<industry> trends 2026"`, `"<category> market signals"`), Gemini synthesises 4–6 trend cards `{ title, summary, signals[], sources[] }`.

Function input: `{ analysisId }`. It loads the analysis + competitors, runs both flows in parallel, writes results back to the `analyses` row, returns the payload.

### Caching & refresh

Add two columns to `analyses` (migration):
- `recent_announcements jsonb`
- `market_trends jsonb`
- `intel_updated_at timestamptz`

On first view of the Comparison tab, the UI:
- Renders cached data immediately if present.
- If missing or older than 24h, auto-invokes `market-intel`.
- The per-card **Refresh** button re-invokes the function (force flag) and updates just that section's slice.

The existing `rerunAnalysis` flow also clears these so a full rerun regenerates intel.

### Files

| File | Change |
|------|--------|
| New migration | Add `recent_announcements`, `market_trends`, `intel_updated_at` to `public.analyses` |
| New `supabase/functions/market-intel/index.ts` | Firecrawl + Gemini pipeline, writes back to `analyses` |
| `supabase/config.toml` | Register `[functions.market-intel]` with `verify_jwt = false` |
| `src/components/AnalysisResults.tsx` | Restructure Comparison tab into 2-col grid; add `RecentAnnouncementsCard` + `MarketTrendsCard` (can be inline subcomponents); fetch/refresh logic; clear intel on rerun |

### Out of scope
- No changes to the Summary or Strategy tabs.
- No new tables (kept on `analyses` for simplicity); if volume grows we can split into `analysis_intel` later.
- No realtime subscription — manual refresh + 24h staleness check is enough for v1.

### Dependencies / assumptions
- `FIRECRAWL_API_KEY` is already configured (confirmed in secrets).
- `LOVABLE_API_KEY` is available for Gemini calls via the AI gateway.
- Existing categories on the analysis give enough signal to derive "industry" — we'll combine `user_company`, `user_product`, and top categories for the trend queries.
