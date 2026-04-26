# mealie-mcp-ts

MCP server for Mealie. Supports both stdio (local Claude Desktop) and Streamable HTTP (remote, e.g. NAS) transports, toggled via `MCP_TRANSPORT` env var.

## Deployment target

Runs in a container on the user's Synology NAS alongside Mealie, on the `mealie_net` external Docker network. Claude Desktop on the Mac connects via `http://<nas>:3000/mcp`.

## Shipping changes to the NAS

Use the `./dev` script — it bundles test/build/version-bump/tag/CI-watch/redeploy into one command:

```bash
./dev release 1.2.3       # no leading 'v'
```

What it does (in order):
1. `pnpm test` and `pnpm run build` — fail fast if anything is broken
2. Bumps `package.json` version
3. **`git add -u`** to stage all tracked changes (src, tests, docs) + `package.json`. This is critical — without it the tagged image won't contain in-flight source changes (this footgun bit us in v1.0.4..v1.0.6, which were empty bumps).
4. Commits "Release v1.2.3" if anything is staged
5. Pushes master, creates `v1.2.3` tag, pushes the tag
6. Watches the `docker-publish.yml` workflow run via `gh run watch`
7. Calls `cmd_nas_redeploy` → `docker compose pull` + `docker compose up -d --force-recreate mealie-mcp` over SSH (note: `--force-recreate` is required because compose pins `:latest`, so plain `up -d` skips recreation even after a pull)

Pushing to master and tagging are flagged as risky by the safety policy — the user must explicitly authorize each `git push` step. Don't try to bypass.

### Faster iteration without a release

For NAS-only redeploys (e.g. re-pulling latest after a workflow re-run):
```bash
./dev nas:redeploy        # pull + force-recreate, prints running image hash
./dev nas:logs -f         # tail container logs
./dev nas:restart         # restart in place (no image change)
```

For verifying the live MCP:
```bash
./dev mcp:ping            # get_current_user round-trip
./dev mcp:list            # tools/list
./dev mcp:get <slug>      # fetch a recipe
./dev mcp:call <tool> '<json>'
```

### Image tags

Docker Hub publishes (metadata-action strips the `v`):
- `corylogan/mealie-mcp:1.2.3` (exact)
- `corylogan/mealie-mcp:1.2` (minor-floating)
- `corylogan/mealie-mcp:latest` (compose pulls this)

GitHub repo settings the workflow needs (already configured):
- Variable `DOCKERHUB_USERNAME`
- Secret `DOCKERHUB_TOKEN` (Docker Hub PAT, read+write)

Re-run a failed publish without a new tag: Actions tab → run → **Re-run jobs**, or trigger via `workflow_dispatch`. The Container Manager UI also exposes Project → **Pull + Apply** as a fallback path, but `./dev nas:redeploy` is faster.

## Local development

- `pnpm install`
- `pnpm dev` — stdio mode (default)
- `MCP_TRANSPORT=http PORT=3000 ALLOWED_HOSTS=localhost pnpm dev` — HTTP mode
- `pnpm run build` — typecheck + compile to `dist/`
- `pnpm test` — run all tool tests (vitest)
- `pnpm run test:watch` — watch mode
- `pnpm run lint` / `pnpm run format` — Biome

Tests live in `tests/` and mock `MealieApi`. Every tool has a happy-path test; URL-scraping tools have extra coverage for error paths. CI runs tests on every push/PR and gates Docker publishes on them.

Test an HTTP-mode server:
```bash
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
