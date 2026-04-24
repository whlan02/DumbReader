# Third-Party Notices

This project uses third-party open-source software.

Project license: `AGPL-3.0-or-later`.
Third-party dependencies keep their own original licenses (for example MIT/ISC/BSD-2-Clause).

## Compliance approach

- Keep this file and the project `LICENSE` file when distributing builds.
- Preserve copyright and license notices for third-party dependencies.
- Regenerate dependency license reports after dependency changes.

## Primary runtime dependencies

Direct production dependencies and their declared licenses:

- `react` — MIT
- `react-dom` — MIT
- `vite` (tooling, not runtime in browser build) — MIT
- `lucide-react` — ISC
- `react-markdown` — MIT
- `rehype-raw` — MIT
- `remark-gfm` — MIT
- `sentence-splitter` — MIT

## Transitive license summary (production)

Current scan result:

- MIT
- ISC
- BSD-2-Clause

## How to regenerate

Run:

```bash
npm run licenses:summary
npm run licenses:report
```

This writes a machine-readable license inventory to `THIRD_PARTY_LICENSES.json`.
