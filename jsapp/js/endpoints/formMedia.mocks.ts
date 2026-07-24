import type { FilesResponse } from '#/api/models/filesResponse'
import {
  getApiV2AssetsFilesCreateMockHandler,
  getApiV2AssetsFilesCreateResponseMock,
  getApiV2AssetsFilesDestroyMockHandler,
  getApiV2AssetsFilesListMockHandler,
} from '#/api/react-query/survey-data/msw'

/**
 * Extended FilesResponse type with redirect_url in metadata.
 * Used when the media item points to an external URL.
 */
export interface FormMediaItem extends Omit<FilesResponse, 'metadata'> {
  metadata: FilesResponse['metadata'] & {
    redirect_url?: string
  }
}

interface CreateFormMediaPayload {
  description?: string
  file_type?: string
  // metadata may arrive as a JSON string (legacy URL-encoded POST) or as a
  // parsed object (JSON POST from the orval-generated client).
  metadata?: string | Record<string, unknown>
  base64Encoded?: string
}

interface FormMediaMockOptions {
  // Optional per-filename delays for story/play-test scenarios.
  uploadDelayByFilenameMs?: Record<string, number>
}

function parsePayloadFromText(textPayload: string): CreateFormMediaPayload {
  const params = new URLSearchParams(textPayload)
  return {
    description: params.get('description') ?? undefined,
    file_type: params.get('file_type') ?? undefined,
    metadata: params.get('metadata') ?? undefined,
    base64Encoded: params.get('base64Encoded') ?? undefined,
  }
}

async function parsePayload(request: Request): Promise<CreateFormMediaPayload> {
  const contentType = request.headers.get('content-type') || ''

  // Keep this branch for components that may switch to JSON POST later.
  if (contentType.includes('application/json')) {
    return (await request.json()) as CreateFormMediaPayload
  }

  // Current uploader sends URL-encoded form payloads.
  return parsePayloadFromText(await request.text())
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Creates a form media item using Orval's generated mock with deterministic IDs.
 * If assetUid is not provided in overrides, uses 'mock-asset-uid' as default.
 */
export function createFormMediaItem(index: number, overrides: Partial<FormMediaItem> = {}): FormMediaItem {
  const uid = overrides.uid ?? `form-media-${index}`
  const filename = overrides.metadata?.filename ?? `file-${index}.png`
  // Extract asset UID from overrides.asset URL if provided, or use overrides.uid, or default
  const assetUid = overrides.asset?.match(/\/assets\/([^/]+)\//)?.[1] ?? 'mock-asset-uid'

  return {
    ...getApiV2AssetsFilesCreateResponseMock({
      uid,
      url: `/api/v2/assets/${assetUid}/files/${uid}/`,
      asset: `/api/v2/assets/${assetUid}/`,
      user: '/api/v2/users/storybook/',
      user__username: 'storybook',
      file_type: 'form_media',
      description: 'default',
      date_created: new Date(2026, 0, index).toISOString(),
      content: `/media/mock/${filename}`,
      metadata: {
        hash: `hash-${index}`,
        filename,
        mimetype: 'image/png',
      },
    }),
    ...overrides,
    metadata: {
      hash: `hash-${index}`,
      filename,
      mimetype: 'image/png',
      ...overrides.metadata,
    },
  } as FormMediaItem
}

/**
 * Stateful form media handlers using Orval-generated MSW handlers.
 * Maintains an in-memory list that persists across requests within a Storybook session.
 */
export function formMediaHandlers(
  assetUid: string,
  seedItems: FormMediaItem[] = [createFormMediaItem(1)],
  options: FormMediaMockOptions = {},
) {
  // We mutate this local array to mimic backend persistence between requests
  // inside a single Storybook run.
  const mediaItems = [...seedItems]

  return [
    // GET list - returns current items
    getApiV2AssetsFilesListMockHandler(async ({ params }) => {
      if (params.uidAsset !== assetUid) {
        return undefined as any
      }
      return {
        count: mediaItems.length,
        next: null,
        previous: null,
        results: mediaItems,
      }
    }),

    // POST create - adds item to list
    getApiV2AssetsFilesCreateMockHandler(async ({ params, request }) => {
      if (params.uidAsset !== assetUid) {
        return undefined as any
      }

      const payload = await parsePayload(request)
      // metadata may be a JSON string (legacy form-encoded POST) or a plain
      // object (JSON POST from the orval-generated client).
      const parsedMetadata =
        typeof payload.metadata === 'string'
          ? (JSON.parse(payload.metadata) as Record<string, unknown>)
          : (payload.metadata ?? {})

      const fileName = parsedMetadata.filename as string | undefined
      // Unknown filenames (or missing delay map) upload immediately.
      const delayMs = (fileName && options.uploadDelayByFilenameMs?.[fileName]) || 0
      if (delayMs > 0) {
        await waitMs(delayMs)
      }

      const index = mediaItems.length + 1
      const newItem = createFormMediaItem(index, {
        uid: `form-media-${index}`,
        url: `/api/v2/assets/${assetUid}/files/form-media-${index}/`,
        asset: `/api/v2/assets/${assetUid}/`,
        metadata: {
          hash: `hash-${index}`,
          filename: (parsedMetadata.filename as string | undefined) || `uploaded-${index}.dat`,
          mimetype: 'application/octet-stream',
          redirect_url: parsedMetadata.redirect_url as string | undefined,
        },
        content: (parsedMetadata.redirect_url as string | undefined) || `/media/mock/uploaded-${index}.dat`,
      })

      mediaItems.push(newItem)
      // Return created item so UI can behave like real API responses.
      return newItem
    }),

    // DELETE - removes item from list
    getApiV2AssetsFilesDestroyMockHandler(async ({ params }) => {
      if (params.uidAsset !== assetUid) {
        return
      }
      const itemIndex = mediaItems.findIndex((item) => item.uid === params.uidFile)
      if (itemIndex > -1) {
        mediaItems.splice(itemIndex, 1)
      }
    }),
  ]
}

export default formMediaHandlers
