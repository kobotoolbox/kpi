// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper for the component
import { PasswordInput as PasswordInputMantine } from '@mantine/core'
import type { PasswordInputProps as PasswordInputPropsMantine } from '@mantine/core'
import KoboIcon from './KoboIcon'
import { resolveIconComponentByLegacyName } from './KoboIconMappings'

export type PasswordInputProps = PasswordInputPropsMantine

/** Our eye icons. `reveal` means the password is visible, so the icon offers to hide it. */
function VisibilityToggleIcon({ reveal }: { reveal: boolean }) {
  return <KoboIcon icon={resolveIconComponentByLegacyName(reveal ? 'figma-eye-off' : 'view')} size='sm' />
}

function PasswordInput(props: PasswordInputProps) {
  return <PasswordInputMantine visibilityToggleIcon={VisibilityToggleIcon} {...props} />
}
export default PasswordInput
