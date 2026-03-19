
## Plan: Fix 3 bugs in the SSO flow

### Context
The Lovable **preview** shows a permanent loading spinner because the sandbox iframe blocks token-refresh network calls — this is expected behavior in the preview, not a code bug. The published URL (competitive-buddy.lovable.app) works for auth as confirmed by the auth logs.

However, there are 3 real bugs that affect the published app:

---

### Bug 1 — Profile never auto-created on signup (critical)
The `handle_new_user()` database function exists but its trigger was never registered in the database. The `<db-triggers>` section explicitly says "no triggers". This means every user who signs in for the first time gets `profile = null`, so their name and avatar never appear in the header or dashboard.

**Fix:** Create a migration that registers the trigger on `auth.users`.

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Additionally, backfill profiles for the 2 existing users (Anshita/Google and Apple private relay user) who signed up before the trigger existed.

---

### Bug 2 — `isNewUser` stays `true` after first analysis (logic bug)
`refreshIsNewUser()` is called inside `handleAnalysisComplete()` with `await`, but the state update is async — the parent `Index` component re-renders and `getEffectiveView()` still reads the stale `isNewUser=true` from the previous render. The user sees the onboarding again instead of being redirected to results.

**Fix:** In `Index.tsx`, after calling `refreshIsNewUser()`, explicitly force the view to `'results'` (which is already done via `setView('results')` called before `refreshIsNewUser`). The real fix is to ensure `getEffectiveView()` uses the locally set `view` state as the source of truth when it is not null — which the current code already does (`if (view !== null) return view`). 

The actual bug is subtler: `view` is set to `'results'` correctly, but `isNewUser` remains `true` until the next render cycle after `refreshIsNewUser` completes. This causes no real problem since `view !== null` takes precedence. However, if the user navigates back to the logo (which calls `setView(isNewUser ? 'onboarding' : 'dashboard')`), they'd land on onboarding instead of dashboard because `isNewUser` hasn't updated yet.

**Fix:** In the logo click handler in `Index.tsx`, always navigate to `'dashboard'` when the user has already completed an analysis (i.e., `view === 'results'`), regardless of `isNewUser`.

---

### Bug 3 — Footer "Connect" text missing
The footer LinkedIn link shows only an icon with no text. The `Connect` text was accidentally removed.

**Fix:** Restore `Connect` text before the LinkedIn icon in `Index.tsx` footer.

---

### Files to change

| File | Change |
|------|--------|
| New migration | Register `on_auth_user_created` trigger + backfill existing users |
| `src/pages/Index.tsx` | Fix logo-click nav logic + restore "Connect" text in footer |

---

### What this does NOT change
- Auth flow itself (Google + Apple SSO) — already working correctly on the published URL
- Database schema — no table changes needed
- The preview loading spinner — this is expected sandbox behavior, not a bug
