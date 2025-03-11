Coding Style Guidelines for Frontend
=======================================




Automatic Linting Rules
---------------------------------------


Kobotoolbox uses automated tools to assist developers in three ways:
- formatting: enforce consistent code style.
- organize imports: enforce consistent import statement order sorted by "distance" and natural ordering.
- linting: enforce fixing common errors and writing modern code.

Kobotoolbox uses the fast [Biome](https://biomejs.dev/) for all three, although it's linter is not type-aware, and [ESLint](https://typescript-eslint.io/) for linting only. There are plans to adopt [oxlint](https://oxc.rs/docs/guide/usage/linter.html) in the future, it's an upcoming performant competitor to ESlint, but isn't type-aware yet and thus limited in it's capacity.

Kobotoolbox is in progress of gradually adopting Biome. Please find TODOs in [`./biome.jsonc`](./biome.jsonc).




Manual Linting Rules
---------------------------------------


### Generic

- tag `@deprecated` when deprecating code and explain what to do instead. FYI VSCode nicely strike-through deprecated code.
  - example TS/JSDoc syntax to deprecate external dependencies:
    ```ts
    declare namespace JQuery {
      /** @deprecated use fetch instead */
      export interface jqXHR {
      }
    }
    ```

- don't use `@deprecated` code.


### Naming is hard

- singular for objects (`user`), plural for arrays/maps/etc (`users`), suffix for primitives (`userName`).
- don't use Systems Hungarian (e.g. `strExample`), because let's don't duplicate intellisense. Except for boolean type, because it reads nice, e.g. `isExample`, `hasExample`, etc.
- use [Hungarian Notation](https://www.joelonsoftware.com/2005/05/11/making-wrong-code-look-wrong/) where appropriate (indicate *kind* of the type). Examples: `input` and `inputSanitized` or other way around `inputRaw` and `input`, your choice.
- boilerplate snippets:
  - `const exampleQuery = useExampleQuery()` for react query hook usage.
  - `import cx from 'classnames';` for classnames import.


### Code colocation

Main principle is, keep related code close for modularity. Organize by feature/usage/concept, not type (images at images, etc.). Sanity check question: if requirements would change, what parts of code would likely be changed or deleted together as a bundle?

- organize folders and subfolders by root/global, feature, sub-feature, sub-sub-feature, …. Each level may have generic `common` , `components` and `hooks` folders. Place code as deep as possible to be above or next to all it's consumers. Update as consumers change. Example:
  ```bash
  /
    jsapp/
      common/           # <-- (4) reused non-react-stuff globally go here.
      components/       # <-- (4) reused components globally go here.
      hooks/            # <-- (4) reused hooks globally go here.
      BigFeat/
        common/         # <-- (3) reused non-react-stuff within feature go here.
        components/     # <-- (3) reused components within feature go here.
        hooks/          # <-- (3) reused hooks within sub-feature go here.
        index.tsx
        BigFeatTable/
          common/       # <-- (2) reused non-react-stuff within component goes here.
          components/   # <-- (2) reused components within component goes here.
          hooks/        # <-- (2) reused hooks within component goes here.
          index.tsx     # <-- (1) small helpers or interfaces are co-located inside
                        #         component or hook files, and are not exported.
          useExample.ts # <-- (1) files specific only to other file(s)
                        #         in the same folder stay next to them.
  ```
- organize files by concerns and name it by that. Keep one concern per file. Don't shy away from small but focused files.
     - one React component per file and name it the same — `Example.tsx` or `Example/index.tsx`.
     - one React hook per file and name it the same — `useExample.tsx` or `useExample/index.tsx`.
     - for anything big and/or complex enough, have a seperate file and name it the same.
     - it's ok to co-locate in the same file several similar variations of the same, as well accompanying constants, helpers, type-guards and other utils.
- every folder has a meaningful `index.tsx` files, except `common`, `components`, and `hooks` folders. Index file contains and/or re-exports what consumers outside of folder imports (kinda as folder's API).
- Include type of file in filename only for tests and storybook. Such as:
    - `{index,Example}.tsx?`
    - `{index,Example}.stories.tsx`
    - `{index,Example}.{spec,test}.tsx?`
    - `useExample.tsx?`
    - `useExample.{spec,test}.tsx?`


### React specific

- use Typescript, don't use Javascript.
- use React functional components and hooks instead of classes and HOCs.
- for response caching use `react-query`, don't reinvent cache using state.

