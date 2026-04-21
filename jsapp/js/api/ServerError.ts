import type { ErrorDetail } from './models/errorDetail'
import type { ErrorObject } from './models/errorObject'

export class ServerError extends Error implements ErrorObject, ErrorDetail {
  static async new(response: Response) {
    let payload: any
    let detail: any
    const text = await response.text()
    try {
      payload = JSON.parse(text)
      // Preserve the full parsed response for callers that need endpoint-specific
      // validation payloads, while keeping `detail` backward-compatible for the
      // existing generic error handling and stringification behavior.
      detail = typeof payload === 'object' && payload !== null && 'detail' in payload ? payload.detail : undefined
    } catch {
      payload = text
      detail = text
    }
    return new ServerError(response, detail, payload)
  }

  constructor(
    public response: Response,
    public detail: any,
    public payload: any,
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
