import React, { Suspense } from 'react'

// No prefetch: most users never see the meter.
const PasswordStrength = React.lazy(() => import('./passwordStrength.component'))

/** Password strength meter that loads zxcvbn (~800 KB) on first render, and shows nothing until then. */
export default function LazyPasswordStrength(props: React.ComponentProps<typeof PasswordStrength>) {
  return (
    <Suspense fallback={null}>
      <PasswordStrength {...props} />
    </Suspense>
  )
}
