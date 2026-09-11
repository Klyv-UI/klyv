# Citrine over MCP

An MCP server that gives an AI coding agent the same knowledge the
documentation site has: what the 250+ components are, every prop with its real
type and default, the design tokens in both themes, the rules the system obeys,
and each component's actual source with everything it imports.

It reads the generated bundle in [`../data`](../data), so it never disagrees
with the docs, the CLI or the package — all four come from one generator.

## Connect it

The server ships with the package, so no separate install is needed.

**Claude Code** — from a project that depends on `citrine`:

```bash
claude mcp add citrine -- npx -y citrine-mcp
```

**Anything that reads `mcp.json`** (Claude Desktop, Cursor, Windsurf, VS Code):

```json
{
  "mcpServers": {
    "citrine": {
      "command": "npx",
      "args": ["-y", "citrine-mcp"]
    }
  }
}
```

Already have Citrine installed? Point at the local copy and skip the fetch:

```json
{
  "mcpServers": {
    "citrine": {
      "command": "node",
      "args": ["./node_modules/citrine/mcp/server.mjs"]
    }
  }
}
```

## Tools

| Tool | Returns |
| --- | --- |
| `search_components` | matches by name, group, or what they do |
| `get_component` | props, types, defaults, ARIA roles, gzipped size, dependencies |
| `get_component_source` | the real source, optionally with everything it imports |
| `list_blocks` | whole screens, by category |
| `get_block` | one screen: its components, its packages and its full source |
| `list_groups` | the thirteen groups and their counts |
| `get_design_tokens` | colour, radius, shadow and type, plus dark-mode values |
| `get_design_rules` | the design system and the five house rules |
| `how_to_install` | package, stylesheet, peer dependencies, icons |

Names are forgiving: `DataTable`, `data-table` and `datatable` all resolve, and
a miss suggests near matches rather than failing.

## Resources

`citrine://catalog`, `citrine://blocks`, `citrine://tokens`, `citrine://rules`, `citrine://usage` —
the same knowledge for clients that prefer to attach documents over calling
tools.

## Skill

For harnesses that load Agent Skills instead of (or alongside) MCP,
[`../skills/citrine/SKILL.md`](../skills/citrine/SKILL.md) carries the same
guidance in one file: when to reach for what, the theming API, and the mistakes
that come up most.

## Implementation

Plain JSON-RPC 2.0 over stdio in one file, no SDK. A library that advertises
two runtime dependencies should not quietly add a third, and the stdio
transport is small enough to implement exactly. `test/mcp.test.mjs` drives the
real process over real pipes.
