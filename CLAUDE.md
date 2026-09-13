@AGENTS.md

# Git Branch Policy
Always commit and push directly to the `main` branch. Do NOT create feature branches unless explicitly asked to. Never use claude/* branches.

# What's New Changelog
Whenever you ship a user-facing feature, UI change, or notable fix, add an entry to the changelog so users see it in the app:

1. Open `src/components/WhatsNewModal.tsx` and add a new release object to the **top** of the `CHANGELOG` array (newest first):
   ```ts
   {
     version: 'vX.Y.Z',        // bump from the current top entry's version
     date: 'Mon YYYY',         // e.g. 'Sep 2026'
     items: [
       { type: 'new', text: 'One sentence, written for the user — what changed and why it helps them.' },
     ],
   },
   ```
   `type` is one of `'new' | 'improvement' | 'fix' | 'security'`. Bundle everything from the same piece of work into one release entry with multiple `items` rather than creating several small versions.
2. Update `LATEST_VERSION` in `src/components/whatsNewConstants.ts` to match the new version string — this is what drives the "new update" bell badge on the dashboard.
3. Write entries in plain user language (what they can now do / what got better), not implementation detail — see existing entries for tone.

Skip this only for internal-only changes with no visible effect (refactors, migrations with no behavior change, dependency bumps, etc).
