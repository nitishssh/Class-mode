# Attribution & Vendoring Notice

This directory (`features/ai-classroom/studyArena`) is **derived from OpenMAIC**, the
Open Multi-Agent Interactive Classroom by the THU-MAIC team at Tsinghua University.

- **Upstream project:** OpenMAIC — https://github.com/THU-MAIC/OpenMAIC
- **Upstream license:** MIT
- **Live reference:** https://open.maic.chat
- **Vendored:** copied in as a standalone microservice and rebranded ("MAIC" → "Friday Learning",
  "Claw" assistant → "iniclaw"). Based on an early upstream snapshot (~v0.1.x); some
  dependencies (e.g. Next.js) were bumped locally.

## Required upstream license notice (MIT)

OpenMAIC is MIT-licensed. The MIT license **requires** that the original copyright and
permission notice be retained in all copies or substantial portions of the software.
That notice is preserved here:

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

## ⚠️ License discrepancy to resolve

The local `LICENSE` file and `package.json` currently declare **AGPL-3.0**, while the
upstream code is **MIT**. MIT permits relicensing/sublicensing a derivative, **but only if
the MIT notice above is retained** (this file satisfies that). Two clean options — pick one:

1. **Keep it MIT** (recommended for a near-verbatim copy): set `package.json` `"license": "MIT"`
   and replace the local `LICENSE` with the MIT text above. Honest and simplest.
2. **Overlay AGPL on your own additions:** keep AGPL for code you wrote, but the MIT-origin
   portions remain MIT and this notice must stay. Only worthwhile once your changes are
   substantial and you specifically want copyleft.

Until this is resolved, this NOTICE keeps the project MIT-attribution-compliant.
</content>
</invoke>
