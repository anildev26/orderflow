<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent skills (local only)

Do not install skills. Fetching a pack and reading `SKILL.md` costs more tokens than it saves on this app. Do not install caveman, ponytail, code-simplifier, context-mode, any other skill from those repos, the rtk CLI, or the context-mode MCP server.

When you promote a user-facing update, do only this:

- Ship the smallest change that finishes the update. No extra refactors, files, or options.
- Add one What's New entry and bump `LATEST_VERSION`, in plain user language. The steps are in `CLAUDE.md`.
- Keep chat short.

`.agents/` and `skills-lock.json` are gitignored. Never `git add -f` them. Run `git status` before each commit and confirm no skill files are staged. If those ignore rules are missing, add them to `.gitignore`.
