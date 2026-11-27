import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

const greyBox = { padding: '0.5rem', backgroundColor: 'rgba(200,200,200, 0.5)' }

/**
 * Replaces react-router's default error screen, which ships its "Hey developer" tip to production.
 */
export default function RouteErrorFallback() {
  const error = useRouteError()

  let message: string
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`
  } else if (error instanceof Error) {
    message = error.message
  } else {
    message = JSON.stringify(error)
  }

  return (
    <>
      <h2>{t('Unexpected Application Error!')}</h2>
      <h3 style={{ fontStyle: 'italic' }}>{message}</h3>
      {/* Kept so screenshots sent to support still show where it broke */}
      {error instanceof Error && error.stack && <pre style={greyBox}>{error.stack}</pre>}
    </>
  )
}
