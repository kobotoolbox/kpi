import { http, HttpResponse } from 'msw'
import { endpoints } from '#/api.endpoints'
import formMediaFactory, { type FormMediaItem } from './formMedia.factory'

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

export function formMediaHandlers(
  assetUid: string,
  seedItems: FormMediaItem[] = [formMediaFactory(1)],
  options: FormMediaMockOptions = {},
) {
  // We mutate this local array to mimic backend persistence between requests
  // inside a single Storybook run.
  const mediaItems = [...seedItems]

  return [
    http.get(endpoints.ASSET_FILES_LIST, ({ params }) => {
      if (params.uid !== assetUid) {
        return undefined
      }

      return HttpResponse.json({
        count: mediaItems.length,
        next: null,
        previous: null,
        results: mediaItems,
      })
    }),

    http.post(endpoints.ASSET_FILES_LIST, async ({ params, request }) => {
      if (params.uid !== assetUid) {
        return undefined
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

      const newItem = formMediaFactory(index, {
        uid: `form-media-${index}`,
        url: endpoints.ASSET_FILE_DETAIL.replace(':uid', assetUid).replace(':fileUid', `form-media-${index}`),
        metadata: {
          hash: `hash-${index}`,
          size: 2048,
          type: 'application/octet-stream',
          filename: (parsedMetadata.filename as string | undefined) || `uploaded-${index}.dat`,
          mimetype: 'application/octet-stream',
          redirect_url: parsedMetadata.redirect_url as string | undefined,
        },
        content: (parsedMetadata.redirect_url as string | undefined) || `/media/mock/uploaded-${index}.dat`,
      })

      mediaItems.push(newItem)

      // Return created item so UI can behave like real API responses.
      return HttpResponse.json(newItem, { status: 201 })
    }),

    http.delete(endpoints.ASSET_FILE_DETAIL, ({ params }) => {
      if (params.uid !== assetUid) {
        return undefined
      }

      const itemIndex = mediaItems.findIndex((item) => item.uid === params.fileUid)
      if (itemIndex > -1) {
        mediaItems.splice(itemIndex, 1)
      }

      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

export default formMediaHandlers
