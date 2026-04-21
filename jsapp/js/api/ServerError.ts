import type { ErrorDetail } from './models/errorDetail'
import type { ErrorObject } from './models/errorObject'

export class ServerError extends Error implements ErrorObject, ErrorDetail {
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
      detail = text
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
