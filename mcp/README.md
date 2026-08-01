# Pawline MCP

Read-only Model Context Protocol server for current adoptable dog and cat listings from [Pawline](https://www.pawlineadopt.com).

## Install

```bash
npx -y pawline-mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "pawline": {
      "command": "npx",
      "args": ["-y", "pawline-mcp"]
    }
  }
}
```

The server exposes three tools:

- `search_adoptable_pets` searches current listings and returns official source links.
- `list_adoption_sources` reports Pawline's provider catalog and integration status.
- `check_pawline_status` reports service health and active provider counts.

Set `PAWLINE_API_BASE` only when targeting another Pawline deployment during development.

Listings are time-sensitive. Confirm availability and all adoption details directly with the linked shelter. Pawline search results are not compatibility decisions or guarantees.
