# Priority 0.3.6 verification

`kanban.priority=high|normal|low`, missing means normal. Cards, owners and chats expose priority in `kanban.cards`. `kanban.set-priority` validates input and writes the daemon label. Priority precedes existing stable sorting, including chat and executor subgroups.

Checks: `npm run typecheck`, `npm test` (26 passing tests), `node tests/browser/priority.mjs`.

Browser: test daemon 127.0.0.1:6786, separate headless Chromium, ru-RU, dark at 1440 and 390, light at 1440. Real menu clicks exercise high -> low -> normal -> high; RPC confirms persistence. Invalid priority and a missing agent are rejected. Screenshots include chat and board at both widths.

Shared methodology updated in references/paseo-kanban.md and references/paseo-ceo.md.
