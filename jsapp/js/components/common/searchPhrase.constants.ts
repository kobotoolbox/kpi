/**
 * Mirrors `settings.MINIMUM_DEFAULT_SEARCH_CHARACTERS` on the backend. A handful of views lower their own
 * `min_search_characters`, - this is the default, not a universal truth.
 */
export const MIN_SEARCH_PHRASE_LENGTH = 3

export const TOO_SHORT_SEARCH_WARNING = t('Type at least ##CHARACTER_COUNT## characters to search').replace(
  '##CHARACTER_COUNT##',
  String(MIN_SEARCH_PHRASE_LENGTH),
)
