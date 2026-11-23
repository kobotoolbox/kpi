import TextInput, { type TextInputProps } from '#/components/common/TextInput'

/** A token from the authenticator app or a recovery code. Props override the defaults. */
export default function MfaCodeInput(props: TextInputProps) {
  return (
    <TextInput
      label={t('Code')}
      placeholder={t('Enter token or backup code')}
      // Lets a password manager or a phone hand over the code it just saw
      autoComplete='one-time-code'
      // Not `numeric`: a recovery code is not all digits, and a keypad would hide the letters
      inputMode='text'
      {...props}
    />
  )
}
