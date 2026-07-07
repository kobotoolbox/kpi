import type { TagsInputProps } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper around Mantine TagsInput.
import { TagsInput as MantineTagsInput } from '@mantine/core'

const DEFAULT_PLACEHOLDER = t('Type and confirm with ENTER')
const TAGS_SEPARATOR = ','

export interface KoboTagsInputProps extends Omit<TagsInputProps, 'onChange' | 'value'> {
  value: string[]
  onChange: (tags: string[]) => void
}

const TagsInput = (props: KoboTagsInputProps) => (
  <MantineTagsInput
    {...props}
    onChange={props.onChange}
    splitChars={props.splitChars || [TAGS_SEPARATOR]}
    placeholder={props.placeholder || DEFAULT_PLACEHOLDER}
  />
)

export default TagsInput
