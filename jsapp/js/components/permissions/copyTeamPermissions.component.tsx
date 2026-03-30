import { Box, type ComboboxItem, Group, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import alertify from 'alertifyjs'
import React, { useState, useMemo, useEffect } from 'react'
import { assetsList, getAssetsListQueryKey } from '#/api/react-query/manage-projects-and-library-content'
import assetStore, { type AssetStoreData } from '#/assetStore'
import InfiniteScrollTrigger from '#/components/common/InfiniteScrollTrigger'
import { COMMON_QUERIES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { escapeHtml, notify } from '#/utils'
import { actions } from '../../actions'
import ButtonNew from '../common/ButtonNew'

const ITEMS_PER_PAGE = 10
const INFINITE_SCROLL_PLACEHOLDER = 'InfiniteScrollPlaceholder'

interface CopyTeamPermissionsProps {
  asset: AssetResponse
}

export default function CopyTeamPermissions({ asset }: CopyTeamPermissionsProps) {
  const [isAwaitingAssetChange, setIsAwaitingAssetChange] = useState(false)
  const [isFormOpened, { open: openForm, close: closeForm }] = useDisclosure()
  const [isDropdownOpened, setIsDropdownOpened] = useState(false)
  const [sourceUid, setSourceUid] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearch] = useDebouncedValue(searchValue, 300)

  // Clear things when closing
  useEffect(() => {
    if (!isFormOpened) {
      setSourceUid(null)
      setSourceName(null)
      setSearchValue('')
    }
  }, [isFormOpened])

  useEffect(() => {
    const handleAssetChange = (data: AssetStoreData) => {
      if (data[asset.uid] && isAwaitingAssetChange) {
        setIsAwaitingAssetChange(false)
        closeForm()
      }
    }

    const unlisteners = [
      // We operate here on `assetStore`, because parent component `SharingForm` is operating on it.
      assetStore.listen(handleAssetChange, undefined),
      actions.permissions.copyPermissionsFrom.completed.listen(() => {
        notify(t('permissions were copied successfully'))
      }),
    ]
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [asset.uid, isAwaitingAssetChange])

  function getAssetsListQuery() {
    const queryParts: string[] = []
    // Include search phrase
    if (debouncedSearch) {
      queryParts.push(`(${debouncedSearch})`)
    }
    // Ensure we are only getting surveys
    queryParts.push(COMMON_QUERIES.s)
    return queryParts.join(' AND ')
  }

  const assetsInfiniteQuery = useInfiniteQuery({
    queryKey: [...getAssetsListQueryKey({ q: getAssetsListQuery() }), 'infinite'],
    queryFn: ({ pageParam, signal }) =>
      assetsList({ limit: ITEMS_PER_PAGE, start: pageParam, q: getAssetsListQuery() }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.status === 200 && lastPage.data.next) {
        return allPages.length * ITEMS_PER_PAGE
      }
      return undefined
    },
    enabled: isFormOpened,
    placeholderData: keepPreviousData,
    // Let's not do it. When multiple pages are loaded through infinite scroll, going back to the window will fetch all
    // of the pages. User most probably will use search
    refetchOnWindowFocus: false,
  })

  const rowData = useMemo(() => {
    return assetsInfiniteQuery.data?.pages.flatMap((page) => (page.status === 200 ? page.data.results : [])) || []
  }, [assetsInfiniteQuery.data])

  const onSelectedProjectChange = (newSelectedOption: string | null) => {
    setSourceUid(newSelectedOption)
    if (newSelectedOption) {
      const selectedAsset = rowData.find((a) => a.uid === newSelectedOption)
      if (selectedAsset) {
        setSourceName(selectedAsset.name || t('Untitled'))
      }
    } else {
      setSourceName(null)
    }
  }

  const safeCopyPermissionsFrom = () => {
    if (sourceUid && sourceName && asset.name) {
      const dialog = alertify.dialog('confirm')
      const finalMessage = t(
        'You are about to copy permissions from ##source to ##target. This action cannot be undone.',
      )
        .replace('##source', `<strong>${escapeHtml(sourceName)}</strong>`)
        .replace('##target', `<strong>${escapeHtml(asset.name)}</strong>`)

      const dialogOptions = {
        title: t('Are you sure you want to copy permissions?'),
        message: finalMessage,
        labels: { ok: t('Proceed'), cancel: t('Cancel') },
        onok: () => {
          setIsAwaitingAssetChange(true)
          actions.permissions.copyPermissionsFrom(sourceUid, asset.uid)
        },
        oncancel: () => {
          dialog.destroy()
        },
      }
      dialog.set(dialogOptions).show()
    }
  }

  const isImportButtonEnabled = sourceUid !== null && !isAwaitingAssetChange

  const selectData = useMemo(() => {
    const data: ComboboxItem[] = rowData
      .filter((listAsset) => listAsset.uid !== asset.uid)
      .map((listAsset) => ({
        value: listAsset.uid,
        label: listAsset.name || t('Untitled'),
      }))

    // In case the search query changes and the selected option disappears from the filtered array
    // we want to prepend it manually so Mantine Select doesn't lose track of its label.
    if (sourceUid && !data.some((listAsset) => listAsset.value === sourceUid)) {
      data.unshift({
        value: sourceUid,
        label: sourceName || t('Untitled'),
      })
    }

    // We want to include InfiniteScrollTrigger only when the dropdown is opened (because otherwise all pages will be
    // loaded when Select appears - most possibly due to Mantine's Select inner working) and if there is a next page
    // or next page is being loaded.
    if (isDropdownOpened && (assetsInfiniteQuery.hasNextPage || assetsInfiniteQuery.isFetchingNextPage)) {
      data.push({
        value: INFINITE_SCROLL_PLACEHOLDER,
        label: 'Loading…',
        disabled: true,
      })
    }

    return data
  }, [
    rowData,
    asset.uid,
    sourceUid,
    sourceName,
    assetsInfiniteQuery.hasNextPage,
    assetsInfiniteQuery.isFetchingNextPage,
    isDropdownOpened,
  ])

  return (
    <Box>
      <ButtonNew
        size='md'
        variant='transparent'
        p='0'
        onClick={isFormOpened ? closeForm : openForm}
        rightIcon={isFormOpened ? 'angle-up' : 'angle-down'}
      >
        {t('Copy team from another project')}
      </ButtonNew>

      {isFormOpened && (
        <Stack gap='md'>
          <Text>{t('This will overwrite any existing sharing settings defined in this project.')}</Text>

          <Group p='md' bg='var(--mantine-color-gray-7)'>
            <Select
              size='md'
              searchable
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              onDropdownOpen={() => setIsDropdownOpened(true)}
              onDropdownClose={() => setIsDropdownOpened(false)}
              data={selectData}
              value={sourceUid}
              onChange={onSelectedProjectChange}
              placeholder={t('Select source project…')}
              // Disables client-side filtering since we do it via API
              filter={({ options }) => options}
              nothingFoundMessage={
                assetsInfiniteQuery.isFetching
                  ? t('Loading…')
                  : assetsInfiniteQuery.isError
                    ? t('Failed to load projects')
                    : t('No projects found')
              }
              style={{ flex: 1 }}
              // When using portal I was getting "ResizeObserver loop completed with undelivered notifications" error
              comboboxProps={{ withinPortal: false, position: 'top' }}
              // Magic number to ensure around 5 and half items are visible at a time to visually suggest there are more
              // items if user scrolls
              maxDropdownHeight={210}
              renderOption={({ option }) => {
                if (option.value === INFINITE_SCROLL_PLACEHOLDER) {
                  return (
                    <InfiniteScrollTrigger
                      hasNextPage={assetsInfiniteQuery.hasNextPage}
                      isFetchingNextPage={assetsInfiniteQuery.isFetchingNextPage}
                      isError={assetsInfiniteQuery.isError}
                      onRetry={() => {
                        if (assetsInfiniteQuery.hasNextPage === false) {
                          assetsInfiniteQuery.refetch()
                        } else {
                          assetsInfiniteQuery.fetchNextPage()
                        }
                      }}
                      onRequestFetchNextPage={assetsInfiniteQuery.fetchNextPage}
                      showEndMessage={false}
                    />
                  )
                }
                return <Text>{option.label}</Text>
              }}
            />

            <ButtonNew size='lg' onClick={safeCopyPermissionsFrom} disabled={!isImportButtonEnabled}>
              {t('copy')}
            </ButtonNew>
          </Group>
        </Stack>
      )}
    </Box>
  )
}
