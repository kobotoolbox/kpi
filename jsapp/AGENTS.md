# Frontend

<!-- Maintainers: keep this short. Add a rule when an agent repeats a mistake; leave out what lint or config files already enforce. -->

Read `../CODING_STYLE_FE.md` before writing or restructuring code: it covers naming, folder colocation, file naming and react-query usage.

## Checking work

- Unit tests: `npx jest --config ./jsapp/jest/unit.config.ts <path>`. Jest collects only `*.tests.ts(x)` files, so name tests that way.
- Types: `npm run lint:types`. Lint and format changed files: `npx biome check --write <files>`, then `npx eslint <files>`.
- `npm test` and `npm run build` build Storybook and install Playwright browsers, which takes minutes. Reach for them only when the task is about Storybook or the production build.

## Legacy code

The codebase is mid-migration on several fronts. Most `@deprecated` tags name a replacement; write new code against it. When a change to deprecated code grows beyond a rename or small fix, suggest migrating that piece before extending it.

| Legacy | Replacement |
| --- | --- |
| Reflux `actions` and `stores`, `assetStore`, `api.ts`, `dataInterface.ts` types | Orval react-query hooks and models from `#/api/react-query/<tag>` and `#/api/models` |
| `bem.ts`, global `.scss` | CSS Modules (`*.module.scss`) on plain HTML elements |
| Custom pre-Mantine components and dialogs | Mantine (see UI below) |
| JavaScript | TypeScript. CoffeeScript in `xlform/` stays CoffeeScript. |

## API data

- Each generated `#/api/react-query/<tag>/index.ts` has a sibling `msw.ts` with response mock factories (`get…ResponseMock`) and MSW handlers. Build story and test fixtures from those.

## UI

- Import Mantine components through the Kobo wrapper in `js/components/common/` when one exists. ESLint flags the direct import with a warning that names the wrapper; fix those warnings like errors. Theme overrides live in `js/theme/kobo/`.
- Wrap every user-facing string in the global `t()` with a string literal, and interpolate through a placeholder: `t('##count## projects').replace('##count##', String(count))`. Translation keys are extracted statically at build time, so translators never see a template literal or variable passed to `t()`.
- The developer and project lead decide what goes behind a feature flag. Suggest one when shipping a change without it could cause problems, such as a partly built feature that users could reach once merged, and add one only when asked. A flag is a `FeatureFlag` enum entry in `js/featureFlags.ts`, read with `useFeatureFlag(FeatureFlag.someNameEnabled)` and turned on per session with `?ff_someNameEnabled=true` in the URL.
