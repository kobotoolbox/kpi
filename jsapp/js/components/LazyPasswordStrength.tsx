import React, { Suspense } from 'react'

// No prefetch: most users never see the meter.
const PasswordStrength = React.lazy(() => import('./passwordStrength.component'))

/** The meter is optional, so if its chunk fails to load (flaky connection) it just disappears, not the whole form. */
class HideOnError extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

/** Password strength meter that loads zxcvbn (~800 KB) on first render, and shows nothing until then. */
export default function LazyPasswordStrength(props: React.ComponentProps<typeof PasswordStrength>) {
  return (
    <HideOnError>
      <Suspense fallback={null}>
        <PasswordStrength {...props} />
      </Suspense>
    </HideOnError>
  )
}
