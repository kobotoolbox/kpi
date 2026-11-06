import { Box, LoadingOverlay } from '@mantine/core'
import React, { useEffect, useRef } from 'react'

interface SubmissionStandInProps {
  /** The previous record is standing in while the next one loads. */
  isActive: boolean
  children: React.ReactNode
}

/** Covers a stand-in record, so nobody acts on a record they have stepped away from. */
export default function SubmissionStandIn({ isActive, children }: SubmissionStandInProps) {
  const ref = useRef<HTMLDivElement>(null)

  // The overlay only blocks the mouse; `inert` blocks the keyboard too. Set on the DOM, as React 18 doesn't know it.
  useEffect(() => {
    if (ref.current) {
      ref.current.inert = isActive
    }
  }, [isActive])

  return (
    <Box ref={ref} pos='relative'>
      <LoadingOverlay visible={isActive} />
      {children}
    </Box>
  )
}
