// eslint-disable-next-line no-restricted-imports -- Theme extender must import Mantine primitive directly.
import { Code } from '@mantine/core'

export const CodeThemeKobo = Code.extend({
  vars: (theme) => ({
    root: {
      // Default `--code-bg` is `gray-0`, which is our darkest gray (inverted
      // scale). Use a light gray instead.
      '--code-bg': theme.colors.gray[7],
    },
  }),
})
