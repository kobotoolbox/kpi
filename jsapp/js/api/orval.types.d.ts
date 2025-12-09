import './models/errorDetail'
import './models/errorObject'

// Extend error types with Error object like the custom fetch will return.
declare module './models/errorDetail' {
  interface ErrorDetail extends Error {}
}
declare module './models/errorObject' {
  interface ErrorObject extends Error {}
}
