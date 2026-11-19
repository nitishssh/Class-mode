# ClassMode Mobile

iOS + Android companion for [ClassMode](https://classmode.inmodel.in): school operations, assigned attempt-first learning, and teacher-ready evidence from one TypeScript codebase.

## Roadmap

Work is organized into six phase milestones — see [Milestones](https://github.com/NitishKumar-ai/classmode-mobile/milestones):

1. **Foundation & CI** — typecheck/lint/bundle CI, shared-type drift check, role-aware app shell
2. **Auth & session** — login, secure token storage + refresh, fail-closed role routing
3. **Teacher attendance** — the wedge: one-tap marking with WhatsApp alert feedback
4. **Parent & principal views** — child status, live school dashboard, push notifications
5. **Fees** — admin overview + reminders, parent fee detail
6. **Release** — EAS builds, branding, TestFlight + Play internal testing

Release profiles, Android pilot steps, OTA rules, and store handoff checks live in
[docs/RELEASE.md](docs/RELEASE.md). Run `npm run release:check` before creating a build.

## API contract

The server repo (`Class-mode`) owns the API types in its `shared/` folder. Sync them with:

```bash
npm run sync-shared
```

Never edit `src/shared/` here — it's a generated copy. `zod` stays on **v3** to match the server repo.

Check for contract drift locally with:

```bash
npm run check-shared-drift
```

The scheduled/manual GitHub check needs a repository secret named `CLASSMODE_REPO_READ_TOKEN` with read access to the private `NitishKumar-ai/Class-mode` repo.

---

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
