import { Box, Button, Center, Loader, Stack, Text } from '@mantine/core'
import { useIntersection } from '@mantine/hooks'
import React, { useEffect } from 'react'

export interface InfiniteScrollTriggerProps {
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  isError: boolean
  fetchNextPage: () => void
  /** Optionally hide the "You have reached the end of the list" message. Useful for very short lists. */
  showEndMessage?: boolean
}

export const InfiniteScrollTrigger: React.FC<InfiniteScrollTriggerProps> = ({
  hasNextPage,
  isFetchingNextPage,
  isError,
  fetchNextPage,
  showEndMessage = true,
}) => {
  const { ref, entry } = useIntersection({
    rootMargin: '100px', // Fetch slightly before it actually appears on screen
    threshold: 0.1,
  })

  useEffect(() => {
    // entry?.isIntersecting lets us know the trigger element is visible
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage()
    }
  }, [entry?.isIntersecting, hasNextPage, isFetchingNextPage, isError, fetchNextPage])

  // Hide the entire control row if we don't need to load, don't have an error,
  // don't have a next page, AND the user chose to hide the end message.
  const shouldShowControlRow = isFetchingNextPage || isError || hasNextPage || showEndMessage

  if (!shouldShowControlRow) {
    return null
  }

  return (
    <Box ref={ref} py='md' style={{ overflow: 'hidden', minHeight: '50px' }}>
      {isFetchingNextPage && (
        <Center>
          <Loader size='sm' />
        </Center>
      )}
      {isError && !isFetchingNextPage && (
        <Center>
          <Stack align='center' gap='xs'>
            <Text c='red' size='sm'>
              Failed to load more items.
            </Text>
            <Button variant='danger-secondary' size='xs' onClick={() => fetchNextPage()}>
              Retry
            </Button>
          </Stack>
        </Center>
      )}
      {!hasNextPage && !isFetchingNextPage && !isError && showEndMessage && (
        <Center>
          <Text c='dimmed' size='sm'>
            You have reached the end of the list
          </Text>
        </Center>
      )}
    </Box>
  )
}
