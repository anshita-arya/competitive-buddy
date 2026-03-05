
## Two Changes to Implement

### Change 1 — Role-based analysis persona in `run-analysis` edge function

**Logic:** Classify the `user_role` field into two buckets:

- **Internal/Technical** (PM, Product Manager, Software Engineer, Engineer, Developer, CTO, VP Product, Founder, Designer, Data Scientist, etc.) → Deep technical analysis: feature gaps, architecture signals, technical moats, roadmap signals, API quality, performance benchmarks.
- **Outbound/Sales** (Sales, Account Executive, Account Manager, Field AE, SDR, BDR, Solutions Engineer, Marketing, CMO, etc.) → Sales-positive framing: always lead with the user's company strengths first, then frame competitors as validation of the market, highlight where the user's product wins, minimize competitor strengths as "trade-offs."

**Where:** The system prompt and user prompt in `analyzeWithAI()` will be dynamically adjusted based on the role bucket.

- Internal: "You are a senior competitive intelligence analyst providing deep technical analysis for internal product teams..."
- Outbound: "You are a competitive intelligence specialist for sales teams. Always frame analysis to highlight [userCompany]'s strengths and advantages first. Position competitor features as trade-offs or gaps, not strengths. Help the salesperson tell a compelling story about why [userCompany] wins..."

The `userRole` will be passed into `analyzeWithAI()` and used to choose the right system prompt + tweak the user-facing instructions.

---

### Change 2 — Category selection grid in `OnboardingFlow.tsx`

**Current:** `flex flex-wrap gap-2` with pill buttons, all auto-selected.  
**New:**
- CSS grid layout: `grid grid-cols-2 sm:grid-cols-3 gap-3`
- Each category card: icon area, name (bold), short description (muted text), checkbox/checkmark indicator
- **Default selection:** Only the first category is pre-selected (not all)
- Custom category input stays below the grid, adds a new card to the grid and selects it automatically

---

### Files to change

1. **`supabase/functions/run-analysis/index.ts`**
   - Add `userRole` parameter to `analyzeWithAI()`
   - Add role classification helper (`classifyRole`)
   - Swap system prompt + analysis instructions based on role bucket

2. **`src/components/OnboardingFlow.tsx`**
   - Replace `flex flex-wrap gap-2` pill layout with a `grid` layout for categories
   - Change auto-select from "all" to "first one only"
   - Each item becomes a card with name + description, with a check indicator in corner
