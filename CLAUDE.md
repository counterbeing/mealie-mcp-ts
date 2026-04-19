# mealie-mcp-ts

MCP server for Mealie. Supports both stdio (local Claude Desktop) and Streamable HTTP (remote, e.g. NAS) transports, toggled via `MCP_TRANSPORT` env var.

## Deployment target

Runs in a container on the user's Synology NAS alongside Mealie, on the `mealie_net` external Docker network. Claude Desktop on the Mac connects via `http://<nas>:3000/mcp`.

## Cutting a release

Images are published to Docker Hub automatically by `.github/workflows/docker-publish.yml` on tag push.

```bash
# Bump version in package.json if appropriate, then:
git tag v1.2.3
git push origin v1.2.3
```

Produces these tags on Docker Hub (note: metadata-action strips the `v` prefix):
- `<user>/mealie-mcp:1.2.3` (exact)
- `<user>/mealie-mcp:1.2` (minor-floating)
- `<user>/mealie-mcp:latest`

The workflow requires two repo settings on GitHub (already configured):
- Variable `DOCKERHUB_USERNAME`
- Secret `DOCKERHUB_TOKEN` (Docker Hub personal access token with read+write)

To re-run a failed release without a new tag: Actions tab → pick the run → **Re-run jobs**. Or trigger manually via `workflow_dispatch` (the workflow has it enabled).

To update a running NAS deployment after publishing: Container Manager → Project → **Pull + Apply**.

## Local development

- `pnpm install`
- `pnpm dev` — stdio mode (default)
- `MCP_TRANSPORT=http PORT=3000 ALLOWED_HOSTS=localhost pnpm dev` — HTTP mode
- `pnpm run build` — typecheck + compile to `dist/`
- `pnpm run lint` / `pnpm run format` — Biome

Test an HTTP-mode server:
```bash
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
