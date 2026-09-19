# mcp-worldbank-procurement

World Bank Procurement Notices MCP — global development tenders (keyless).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `wb_procurement_search` | Search World Bank procurement notices — tenders, invitations for bids, requests for expression of interest, contract awards, and general procurement notices for World Bank-financed international development projects in ~140 developing countries (Africa, Asia, Latin America, Middle East, Eastern Europe). ~412k notices, newest first. Full-text search plus filters: country, notice type, and procurement method (Request for Bids, Request for Proposals, consultant selection). Each result includes bid reference, project, deadline, and a public notice URL. Keyless, global multilateral source. |
| `wb_procurement_by_country` | List the latest World Bank procurement notices for one developing country — open tenders, invitations for bids, expressions of interest, and contract awards funded by World Bank international development projects there. Newest first with bid reference, project name, submission deadline, procurement method, and public notice URL. Useful for finding active bidding opportunities or recent government contract activity in countries across Africa, Asia, and Latin America. Keyless. |
| `wb_procurement_awards` | Search World Bank contract awards — which contracts were awarded under World Bank-financed development projects (300k+ award notices across developing countries). Filter by full-text keyword and/or country to see recently awarded goods, civil works, and consulting contracts, each with project, bid reference, procurement method, award publication date, and a public notice URL (the notice detail page names the awarded supplier). Newest first. Keyless. |
| `wb_procurement_detail` | Fetch one World Bank procurement notice by its notice id (e.g. "OP00457469", from wb_procurement_search results). Returns the full record: notice type and status, project, country, bid reference, submission deadline, procurement method, contact person/organization/email/phone, the full notice text (bidding instructions, eligibility, award details for contract awards), and the public notice URL. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "worldbank-procurement": {
      "url": "https://gateway.pipeworx.io/worldbank-procurement/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/worldbank-procurement/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Worldbank Procurement data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/wb_procurement_search \
  -H 'Content-Type: application/json' \
  -d '{"query":"solar panels","country":"Kenya","notice_type":"Invitation for Bids","limit":10}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/wb_procurement_search`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.
