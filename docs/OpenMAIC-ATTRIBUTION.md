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
