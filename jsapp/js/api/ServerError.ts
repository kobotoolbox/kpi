import type { ErrorDetail } from './models/errorDetail'
import type { ErrorObject } from './models/errorObject'

export class ServerError extends Error implements ErrorObject, ErrorDetail {
  static async new(response: Response) {
    let detail: any
    const text = await response.text()
    try {
      detail = JSON.parse(text) as (ErrorObject | ErrorDetail)['detail']
    } catch {
      detail = text
    }
    return new ServerError(response, detail)
  }

  constructor(
    public response: Response,
    public detail: any,
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
