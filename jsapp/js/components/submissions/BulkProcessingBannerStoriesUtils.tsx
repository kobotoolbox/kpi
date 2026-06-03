import type { DecoratorFunction } from '@storybook/types'

const BULK_PROCESSING_BANNER_KEY_PREFIX = 'kpiBulkProcessingBanner-'

export function clearAllBulkProcessingBannerDismissals() {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(BULK_PROCESSING_BANNER_KEY_PREFIX)) {
      sessionStorage.removeItem(key)
    }
  }
}

/**
 * Storybook decorator that resets banner-dismissal session state whenever a
 * story is rendered, so testers can always see the banner again on revisit.
 */
export const withBulkProcessingBannerSessionReset: DecoratorFunction = (Story) => {
  clearAllBulkProcessingBannerDismissals()
  return Story()
}
