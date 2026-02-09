/**
 * See also `SCHEMA_VERSIONS` at `kobo/apps/subsequences/constants.py`.
 */
export const SUBSEQUENCES_SCHEMA_VERSION = '20250820'

/**
 * For simplicity, when creating an object, let's use the server's interface for it to re-use hanndling. But:
 * - such objects sometimes require a UUID, so let's have one, this one.
 * - such objects usually require special handling *somewhere*, then if-else over it's UUID.
 */
export const LOCALLY_EDITED_PLACEHOLDER_UUID = 'placeholder'
