import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import AuthPageFrame from './AuthPageFrame'

/**
 * The `/auth` layout route: {@link AuthPageFrame} around whichever authentication screen the URL points
 * at (sign-in, registration, password recovery, …).
 */
export default function AuthContainer() {
  return (
    <AuthPageFrame>
      {/* Screens are lazy loaded. The boundary sits here so switching between them doesn't blank the frame. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </AuthPageFrame>
  )
}
