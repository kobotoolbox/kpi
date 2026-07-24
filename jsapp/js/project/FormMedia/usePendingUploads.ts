import { useCallback, useRef, useState } from 'react'

/**
 * Tracks in-flight upload requests and exposes a single pending flag.
 *
 * Useful for batch uploads where each file resolves independently, but the UI
 * should stay in a loading state until all pending uploads have finished.
 */
export default function usePendingUploads() {
  const [isPending, setIsPending] = useState(false)
  // `useRef` lets us mutate the counter without triggering re-renders on
  // every increment/decrement. The UI only needs the boolean `isPending`.
  const pendingCountRef = useRef(0)

  const beginBatch = useCallback((count: number) => {
    if (count <= 0) {
      return
    }

    pendingCountRef.current += count
    setIsPending(true)
  }, [])

  const resolveOne = useCallback(() => {
    if (pendingCountRef.current <= 0) {
      // Caller can use this to know there was nothing to resolve.
      return false
    }

    pendingCountRef.current -= 1
    setIsPending(pendingCountRef.current > 0)
    return true
  }, [])

  const reset = useCallback(() => {
    pendingCountRef.current = 0
    setIsPending(false)
  }, [])

  return {
    isPending,
    beginBatch,
    resolveOne,
    reset,
  }
}
