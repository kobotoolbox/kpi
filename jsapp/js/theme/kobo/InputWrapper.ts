import { InputWrapper, rem } from '@mantine/core'
import type { MantineSize } from '@mantine/core'

const INPUT_SIZE_TO_LABEL_SIZES: Partial<Record<MantineSize, string>> = {
  xs: rem(11), // 10px would be too small
  sm: rem(12),
  md: rem(14),
  lg: rem(16),
  xl: rem(18),
}

/**
 * Every input renders its label through `Input.Wrapper` - so this is the one place that reaches `TextInput`, `Select`,
 * `Textarea` and the rest at once
 */
export const InputWrapperThemeKobo = InputWrapper.extend({
  vars: (_theme, props) => {
    return {
      label: { '--input-label-size': INPUT_SIZE_TO_LABEL_SIZES[props.size as MantineSize] },
      error: {},
      description: {},
    }
  },
})
