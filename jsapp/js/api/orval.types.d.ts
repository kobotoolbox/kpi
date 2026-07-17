import './models/errorDetail'

// Extend error types with Error object like the custom fetch will return.
declare module './models/errorDetail' {
  interface ErrorDetail extends Error {}
}
