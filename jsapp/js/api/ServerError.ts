import { getDisplayableErrorText } from './getDisplayableErrorText'
import type { ErrorDetail } from './models/errorDetail'

export class ServerError extends Error implements ErrorDetail {
  static async new(response: Response) {
    let parsedResponse: any
    let detail: any
    const text = await response.text()
    try {
      parsedResponse = JSON.parse(text)
      // Preserve the full parsed response for callers that need endpoint-specific validation, while keeping `detail`
      // backward-compatible for the existing generic error handling and stringification behavior.
      detail =
        typeof parsedResponse === 'object' && parsedResponse !== null && 'detail' in parsedResponse
          ? parsedResponse.detail
          : undefined
    } catch {
      parsedResponse = text
      // The body isn't JSON, so it can be an error page or a traceback. Several components render `detail` straight
      // into the UI, so only keep it when it reads as a message.
      detail = getDisplayableErrorText(text, response.status)
    }
    return new ServerError(response, detail, parsedResponse)
  }

  constructor(
    public response: Response,
    public detail: any,
    public parsedResponse: any,
  ) {
    super(`${response.status} ${response.statusText}`)
    Error.captureStackTrace(this, this.constructor) // Hide custom error implementation details from end-users
  }

  get name() {
    return `${this.constructor.name}`
  }

  toString() {
    return typeof this.detail === 'string' ? this.detail : `${this.response.status} ${this.response.statusText}`
  }

  get [Symbol.toStringTag]() {
    return this.toString()
  }
}
