import type { AssetFileType } from '#/constants'
import type { AssetFileResponse, PaginatedResponse } from '#/dataInterface'

interface MediaUploadPayload {
  description: string
  file_type: AssetFileType | string
  metadata: string
  base64Encoded?: string | ArrayBuffer | null
}

interface GenericMediaCallbackDefinition<T = any> extends Function {
  (response: T): void
  listen: (callback: (response: T) => void) => Function
}

interface MediaLoadMediaDefinition extends Function {
  (uid: string): void
  completed: GenericMediaCallbackDefinition<PaginatedResponse<AssetFileResponse>>
  failed: GenericMediaCallbackDefinition
  listen: (callback: (uid: string) => void) => Function
}

interface MediaUploadMediaDefinition extends Function {
  (uid: string, formMediaJSON: MediaUploadPayload): void
  completed: GenericMediaCallbackDefinition<string>
  failed: GenericMediaCallbackDefinition
  listen: (callback: (uid: string, formMediaJSON: MediaUploadPayload) => void) => Function
}

interface MediaDeleteMediaDefinition extends Function {
  (uid: string, url: string): void
  completed: GenericMediaCallbackDefinition<string>
  failed: GenericMediaCallbackDefinition
  listen: (callback: (uid: string, url: string) => void) => Function
}

interface FormMediaActionsDefinition {
  loadMedia: MediaLoadMediaDefinition
  uploadMedia: MediaUploadMediaDefinition
  deleteMedia: MediaDeleteMediaDefinition
}

declare const formMediaActions: FormMediaActionsDefinition

export default formMediaActions
