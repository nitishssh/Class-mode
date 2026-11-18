# Migration Handoff

Updated 2026-11-17 02:26 IST.

## Current state

- GitHub Project 16 is now `Class-mode — single codebase (web + Android, iOS-ready)`.
- The Expo/React Native client is the intended universal client.
- The Vite web client is to be retired after web parity.
- NativeWind is the selected styling/token path; gluestack-ui v2 is the recommended universal primitive layer.
- Phase 0 token spike and token generator are marked Done.
- Mobile source is now staged under `apps/mobile/` in the Class-mode checkout.
- The staged mobile app uses zod 4 and its 47-test Jest suite, TypeScript check, and lint pass.

## Validated in the shared Class-mode checkout

```text
npm run check:native-tokens  PASS
npm run check                PASS
npm run build                PASS
git diff --check             PASS
CI now runs `npm run check:native-tokens` after TypeScript checking.
```

Non-blocking warnings: stale Browserslist data and large Vite chunks.

## Next work

1. Verify generated token runtime on a real Android device.
2. Decide/record the universal primitive layer.
3. Wire NativeWind and `client/src/index.native.css` into the Expo entry.
4. Rebuild the 51 Radix/shadcn primitives on the universal layer.
5. Port web screens and migrate `lessons.tsx` into the Class-mode client.
6. Keep the inference engine in `server/services/study-arena/` and run its tests from Class-mode.

## Guardrails

- Do not add a second inference engine to the mobile source.
- Do not continue standalone feature work in `classmode-mobile`; it is an input repository only.
- Do not retire Vite until web parity and mobile/native validation are green.
- Preserve the uncommitted token-generator work already present in the shared checkout.
