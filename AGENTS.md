<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent skills (local only)

Install once per workspace. If `.agents/skills/<name>` already exists, skip that skill. Do not reinstall before every change. Never commit skill files.

```bash
test -d .agents/skills/caveman || npx -y skills add JuliusBrussee/caveman --skill caveman -y
test -d .agents/skills/ponytail || npx -y skills add dietrichgebert/ponytail --skill ponytail -y
test -d .agents/skills/code-simplifier || npx -y skills add rtk-ai/rtk --skill code-simplifier -y
test -d .agents/skills/context-mode || npx -y skills add mksglu/context-mode --skill context-mode -y
```

Always pass `--skill`. Without it, `skills add` installs the whole pack.

`.agents/` and `skills-lock.json` are gitignored. Never `git add -f` them. Run `git status` before each commit and confirm no skill files are staged. If a checkout is missing those ignore rules, add them to `.gitignore` (and `.git/info/exclude` only when you cannot change `.gitignore`).

Once per session, read each installed `SKILL.md` under the four directories above. Do not read them again before every change. Follow a skill only when its description matches the task:

- caveman — terse replies
- ponytail — smallest change that finishes the task
- code-simplifier — RTK Rust simplification. Skip it on this TypeScript app.
- context-mode — only when its MCP server is connected in this session (tools such as `ctx_execute`). If it is not connected, skip it.

context-mode saves tokens only while that MCP server is running. Cursor's marketplace plugin is not published yet. To enable it locally, use Option B in the [context-mode README](https://github.com/mksglu/context-mode#cursor--hooks-with-stop-support): `npm install -g context-mode`, register the `context-mode` command in `~/.cursor/mcp.json`, restart Cursor. Do not commit MCP or hook files for this.

The rtk CLI is separate from the code-simplifier skill. It filters shell output, and it only helps when the `rtk` binary is on `PATH`. Once per environment, if `command -v rtk` fails (Homebrew: `brew install rtk`; this image has no Homebrew, and the official curl installer works, putting the binary in `~/.local/bin`):

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
rtk --version
```

Then once, if `~/.cursor/hooks.json` does not already run `rtk hook cursor`:

```bash
rtk init -g --agent cursor
```

That writes a user-level hook, not a repo file. Use rtk for shell output after that (`rtk git status`, `rtk npm test`, or the hook's rewrite). If install or init fails, skip rtk and continue.
