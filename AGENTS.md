<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent skills (local only)

At the start of every session, install these skill packs and use them for every code change. They cut token use. Do not commit the skill files.

```
npx -y skills add JuliusBrussee/caveman -y
npx -y skills add dietrichgebert/ponytail -y
npx -y skills add rtk-ai/rtk -y
npx -y skills add mksglu/context-mode -y
```

They install under `.agents/skills/` and may update `skills-lock.json`. Both paths are in `.gitignore`, so Git does not commit them. Also add them to `.git/info/exclude` (that file is not pushed) if a local checkout is missing the ignore rules:

```
.agents/
skills-lock.json
```

Do not force-add skill files or `skills-lock.json`. Run `git status` before each commit and confirm no skill files are staged.

Use the installed skills on every change:

- caveman: terse replies
- ponytail: smallest change that finishes the task
- rtk skills (`code-simplifier`, `issue-triage`, `pr-triage`, `rtk-triage`): review and triage
- context-mode skills: keep large command and file output out of the transcript when that server is available

The rtk CLI and the context-mode server are separate installs. They save more tokens than the skill files alone. Official commands, checked against each repo README:

- rtk CLI: `brew install rtk` or `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`, then `rtk init -g --agent cursor`
- context-mode server: `npm install -g context-mode` (Cursor wiring is in the context-mode README: local plugin, or MCP plus hooks)
