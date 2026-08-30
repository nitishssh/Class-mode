# OpenMAIC Attribution (MIT)

Parts of Class-mode's Study Arena are **derived from OpenMAIC**, the Open Multi-Agent
Interactive Classroom by the THU-MAIC team at Tsinghua University.

- **Upstream project:** OpenMAIC — https://github.com/THU-MAIC/OpenMAIC
- **Upstream license:** MIT
- **Live reference:** https://open.maic.chat

## Where the derivation lives

The originally vendored microservice (`features/ai-classroom/studyArena`) was removed
in W30 (2026-07). Its used ideas were hand-ported into the native Express/TS stack under
`server/services/study-arena/`. Files carrying "Ported from OpenMAIC" provenance comments
are substantial portions of OpenMAIC and are covered by this notice.

`server/services/study-arena/lesson-script.ts` is an independent, native implementation
of the attempt-first pedagogy (gated `ask` actions); it is inspired by, not ported from,
OpenMAIC.

## Staying aware of upstream (drift check)

The ported files are **not** a generated copy — the port was deliberately simplified and
re-pedagogised, so a byte-diff against upstream is meaningless. What is worth knowing is
whether the OpenMAIC file a port came from has **changed since we last looked**. Without
that signal a hand port becomes a silent fork: upstream fixes and re-architectures land
invisibly.

```
npm run check:study-arena-drift              # check against the pinned ref
npm run check:study-arena-drift -- --update  # re-baseline after reviewing
```

- Baseline: `server/services/study-arena/UPSTREAM.lock.json` (16 upstream files, each
  mapped to the Class-mode file derived from it).
- Source: `raw.githubusercontent.com` at the lockfile's `ref`. Set `$OPENMAIC_REPO` or
  create `.openmaic-repo` (gitignored, see `.openmaic-repo.example`) to run against a
  local checkout offline instead.
- CI: `.github/workflows/study-arena-upstream-drift.yml`, weekly. No token — OpenMAIC is
  public.

A `CHANGED` result is a prompt to read the upstream diff and make a decision — port it, or
record that we diverge on purpose. Either way, re-baseline so the next run is quiet.

`lesson-script.ts` is deliberately **not** tracked: it is an independent implementation of
the attempt-first pedagogy, not a port, so upstream movement does not bear on it.

## Required upstream license notice (MIT)

The MIT license **requires** that the original copyright and permission notice be retained
in all copies or substantial portions of the software. That notice is preserved here:

```
MIT License

Copyright (c) 2026 THU-MAIC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## License resolution (was flagged "to resolve" in the old NOTICE)

The removed vendored copy had self-declared `AGPL-3.0` in its local `LICENSE`/`package.json`
over MIT upstream. That copy is gone. The surviving ported portions in
`server/services/study-arena/` are used under **upstream MIT** plus Class-mode's own
modifications; this file satisfies the MIT attribution requirement. Class-mode's own
repository license governs the modifications.
