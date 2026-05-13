import { TextInput as TextInputMantine } from '@mantine/core'
import type { TextInputProps as TextInputPropsMantine } from '@mantine/core'

export type TextInputProps = TextInputPropsMantine

function TextInput(props: TextInputProps) {
  return <TextInputMantine {...props} />
}
export default TextInput
