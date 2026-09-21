/**
 * The client side checks the authentication screens have in common. The backend is authoritative everywhere, so these
 * only save a round trip.
 */

/**
 * One wording for every empty field on these screens, kept in a function so it is translated at render time rather than
 * at module load.
 */
export const getRequiredFieldMessage = () => t('Required field')

/**
 * A field the form cannot be submitted without. Whitespace does not count as an answer - except in a password, which is
 * why that check is spelled out at each call site instead.
 */
export function validateRequiredField(value: string): string | null {
  return value.trim() ? null : getRequiredFieldMessage()
}
