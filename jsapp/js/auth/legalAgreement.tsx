import { Anchor, Checkbox, type CheckboxProps } from '@mantine/core'

/**
 * Turns every `[...]` marker into a link, taking the URLs in the order they are given. A marker with no URL
 * stays plain text: the sentence still has to name what is being agreed to.
 */
function withLegalLinks(sentence: string, urls: Array<string | null | undefined>) {
  // Splitting on a capturing group alternates plain text and bracketed label, so the labels are the odd
  // entries and take one URL each.
  return sentence.split(/\[([^\]]+)\]/).map((part, index) => {
    if (index % 2 === 0) {
      return part
    }
    const url = urls[Math.floor(index / 2)]
    return url ? (
      <Anchor key={part} href={url} target='_blank' rel='noopener noreferrer' inherit>
        {part}
      </Anchor>
    ) : (
      part
    )
  })
}

/**
 * The checkbox label. The Privacy Policy is named only when it has a URL, which is the only thing saying it
 * exists at all; the terms are named either way, since their URL is optional.
 */
function legalSentence(termsOfServiceUrl: string | null | undefined, privacyPolicyUrl: string | null | undefined) {
  if (privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service] and [Privacy Policy]'), [
      termsOfServiceUrl,
      privacyPolicyUrl,
    ])
  }
  return withLegalLinks(t('I agree with the [Terms of Service]'), [termsOfServiceUrl])
}

export interface TermsOfServiceCheckboxProps extends CheckboxProps {
  /**
   * From `/environment`'s `terms_of_service__sitewidemessage__exists`, which is also what makes the signup
   * endpoint require the field. The URLs below do not decide it, only how much of the label is clickable.
   */
  isRequired: boolean | undefined
  termsOfServiceUrl: string | null | undefined
  privacyPolicyUrl: string | null | undefined
}

/**
 * The legal agreement both signup forms ask for, password and provider, or nothing where this server asks
 * for no agreement. Takes the rest of its props from `form.getInputProps('termsOfService', ...)`.
 */
export function TermsOfServiceCheckbox({
  isRequired,
  termsOfServiceUrl,
  privacyPolicyUrl,
  ...checkboxProps
}: TermsOfServiceCheckboxProps) {
  if (!isRequired) {
    return null
  }
  return <Checkbox label={legalSentence(termsOfServiceUrl, privacyPolicyUrl)} {...checkboxProps} />
}
