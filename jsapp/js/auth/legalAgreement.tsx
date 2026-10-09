import { Anchor } from '@mantine/core'

/** Turns every `[...]` marker into a link, taking the URLs in the order they are given. */
function withLegalLinks(sentence: string, urls: string[]) {
  // Splitting on a capturing group alternates plain text and bracketed label, so the labels are the odd
  // entries and take one URL each.
  return sentence.split(/\[([^\]]+)\]/).map((part, index) =>
    index % 2 ? (
      <Anchor key={part} href={urls[Math.floor(index / 2)]} target='_blank' rel='noopener noreferrer' inherit>
        {part}
      </Anchor>
    ) : (
      part
    ),
  )
}

/**
 * The label for the Terms of Service checkbox, or `null` when the server configures neither document - with
 * nothing to agree to there is no checkbox. Shared by both signup forms, password and provider.
 */
export function legalSentence(
  termsOfServiceUrl: string | null | undefined,
  privacyPolicyUrl: string | null | undefined,
) {
  if (termsOfServiceUrl && privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service] and [Privacy Policy]'), [
      termsOfServiceUrl,
      privacyPolicyUrl,
    ])
  }
  if (termsOfServiceUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service]'), [termsOfServiceUrl])
  }
  if (privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Privacy Policy]'), [privacyPolicyUrl])
  }
  return null
}
