import { Center, Loader, Text } from '@mantine/core'
import { useIntersection } from '@mantine/hooks'
import React, { useEffect } from 'react'
import ButtonNew from './ButtonNew'

export interface InfiniteScrollTriggerProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isError: boolean
  onRequestFetchNextPage: () => void
  /** Optionally hide the "You have reached the end of the list" message. Useful for very short lists. */
  showEndMessage?: boolean
}

/**
 * How to use this? Render this at the end of your (infinitely) scrollable list. Whenever user scrolls down enough for
 * this element to appear, `onRequestFetchNextPage` will be called.
 *
 * To make things DRY, this component already displays a spinner, a retry button, and an end of list message - based on
 * provided props.
 */
export const InfiniteScrollTrigger: React.FC<InfiniteScrollTriggerProps> = ({
  hasNextPage,
  isFetchingNextPage,
  isError,
  onRequestFetchNextPage,
  showEndMessage = true,
}) => {
  const { ref, entry } = useIntersection({
    // Fetch slightly before it actually appears on screen
    rootMargin: '100px',
    threshold: 0.1,
  })

  useEffect(() => {
    // entry?.isIntersecting lets us know the trigger element is visible
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage && !isError) {
      onRequestFetchNextPage()
    }
  }, [entry?.isIntersecting, hasNextPage, isFetchingNextPage, isError, onRequestFetchNextPage])

  // Hide the entire control row if we don't need to load, don't have an error, don't have a next page, or the user
  // chose to hide the end message.
  const shouldShowControlRow = isFetchingNextPage || isError || hasNextPage || showEndMessage

  if (!shouldShowControlRow) {
    return null
  }

  return (
    // We use `minHeight` to ensure the control row is never `0px` height which could cause strange behaviour.
    <Center ref={ref} py='md' style={{ minHeight: '54px' }}>
      {isFetchingNextPage && <Loader size='sm' />}
      {isError && !isFetchingNextPage && (
        <ButtonNew leftIcon='reload' variant='danger-secondary' size='xs' onClick={() => onRequestFetchNextPage()}>
          {t('Retry')}
        </ButtonNew>
      )}
      {!hasNextPage && !isFetchingNextPage && !isError && showEndMessage && (
        <Text size='sm' c='var(--mantine-color-gray-2)'>
          {t("You've reached the end of the list")}
        </Text>
      )}
    </Center>
  )
}
