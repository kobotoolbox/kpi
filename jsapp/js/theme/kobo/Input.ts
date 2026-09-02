import { Input, rem } from '@mantine/core'

/**
 * Heights per our Figma designs. Every input-derived component renders `Input`
 * internally — TextInput, Textarea, NumberInput, PasswordInput, Select, MultiSelect,
 * TagsInput, Autocomplete — so this is what keeps them all the same height.
 *
 * Mantine declares this scale on the Input wrapper class, so a CSS module override
 * would be a load-order gamble; `vars` lands as an inline style and always wins.
 *
 * Note: sizes not shared with Button on purpose.
 */
const inputHeights: Record<string, string> = {
  '--input-height-sm': rem(34),
  '--input-height-md': rem(36),
  '--input-height-lg': rem(40),
}

export const InputThemeKobo = Input.extend({
  vars: () => {
    return { wrapper: inputHeights }
  },
})
