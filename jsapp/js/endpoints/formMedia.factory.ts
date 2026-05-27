import type { AssetFileResponse } from '#/dataInterface'

export interface FormMediaItem extends Omit<AssetFileResponse, 'metadata'> {
  metadata: AssetFileResponse['metadata'] & {
    // Only present when the media item points to an external URL.
    redirect_url?: string
  }
}

export default function formMediaFactory(index: number, overrides: Partial<FormMediaItem> = {}): FormMediaItem {
  // Keep IDs deterministic so stories and tests are easy to read and debug.
  const uid = overrides.uid ?? `form-media-${index}`
  const filename = overrides.metadata?.filename ?? `file-${index}.png`

  return {
    uid,
    url: `/api/v2/assets/mock-asset-uid/files/${uid}/`,
    asset: '/api/v2/assets/mock-asset-uid/',
    user: '/api/v2/users/storybook/',
    user__username: 'storybook',
    file_type: 'form_media',
    description: 'default',
    date_created: new Date(2026, 0, index).toISOString(),
    content: `/media/mock/${filename}`,
    metadata: {
      hash: `hash-${index}`,
      size: 1024,
      type: 'image/png',
      filename,
      mimetype: 'image/png',
      ...overrides.metadata,
    },
    ...overrides,
  }
}
