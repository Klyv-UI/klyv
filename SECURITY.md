# Security

## Reporting a vulnerability

**Do not open a public issue.** Anyone reading it learns about the flaw at the
same moment we do, including in every product already shipping the library.

Report it through GitHub's private channel instead:
[**Report a vulnerability**](https://github.com/Klyv-UI/klyv/security/advisories/new).
It reaches the maintainers privately, and the discussion, the fix and the
advisory all happen in one place.

Please include what you can: which component or function, the version, what an
attacker gets out of it, and the smallest input that shows it.

You can expect a first reply within a week. If a report is confirmed, a fix and
a published advisory follow, and you are credited unless you ask otherwise.

## What is in scope

Klyv is a component library: it renders in someone else's page, with data their
users supply. The things that matter most are the components that take input
apart or put markup together:

- **Anything that renders untrusted text as markup** — `MarkdownEditor`,
  `RichTextEditor`, `AnsiOutput`, `HighlightMatch`, `CodeBlock`, `EmailViewer`
- **Parsers fed by a user** — `JwtInspector`, `RegexTester` (a pattern that
  hangs the page is a real finding), `CsvImport`, `JsonQuery`, `SqlBuilder`,
  `ExifViewer`, `ZipBrowser`, `CronEditor`
- **`Redactor`**, which is supposed to remove secrets from text: a bypass that
  leaves one in is in scope
- **URL and link handling** anywhere a `javascript:` URL could survive
- **The CLI and the MCP server**, both of which read and write files
- **Prototype pollution** through any prop or parsed object

## What is not

- The documentation site's demo data and example credentials. Every key, token
  and card number on klyvui.xyz is a well-known public sample used to show a
  component working — Stripe's documented test key, `4242 4242 4242 4242`.
- Findings from an automated scan with no working example behind them.
- Anything requiring a consumer to pass attacker-controlled values to a prop
  documented as trusted HTML, where the type and the docs say so.
- Missing hardening headers on the docs site, unless you can show the harm.

## Supported versions

The latest published release of `klyvui` on npm. There are no long-term support
branches: fixes go out as a new version.
