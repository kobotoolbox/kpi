import { Center, Checkbox, Group, Loader, MultiSelect, Select, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import * as Sentry from '@sentry/react'
import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import type { Asset } from '#/api/models/asset'
import type { TagListResponse } from '#/api/models/tagListResponse'
import {
  getAssetsListQueryKey,
  getTagsListQueryKey,
  useAssetsList,
  useTagsList,
} from '#/api/react-query/manage-projects-and-library-content'
import Icon from '#/components/common/icon'
import { COMMON_QUERIES } from '#/constants'
import AssetNavigatorCard from './AssetNavigatorCard'

// A stub types for sortable
declare global {
  interface JQuery {
    sortable(options?: any): JQuery
    sortable(
      method: 'destroy' | 'disable' | 'enable' | 'widget' | 'toArray' | 'serialize' | 'refresh' | 'cancel',
      ...args: any[]
    ): JQuery
  }
}

const SORTABLE_ITEM_CLASS_NAME = 'asset-navigator-sortable-item'

export default function AssetNavigator() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Step 1. Fetch Tags for the MultiSelect filter
  // Note: if `limit` is too big (e.g. `9999`) it causes a deadly timeout whenever Form Builder displays the aside Library
  // search, so we use `100`.
  const tagsListParams = { limit: 100 }
  const { data: tagsOptions } = useTagsList(tagsListParams, {
    query: {
      queryKey: getTagsListQueryKey(tagsListParams),
      select: (response) => {
        // We want to know if there are any users who have more than 100 tags. If there is `next` page of results, it
        // means we have more than 100 (the `limit` above)
        if (response?.data && 'next' in response.data) {
          if (response.data.next) {
            Sentry.captureMessage('MAX_TAGS_EXCEEDED: Too many tags')
          }
        }

        if (response?.data && 'results' in response.data) {
          const nonUniqueTags = response.data.results.map((t: TagListResponse) => t.name)
          // Because tags API has a bug we need to ensure only unique results are returned:
          // https://linear.app/kobotoolbox/issue/DEV-1576/duplicated-values-in-apiv2tags-endpoint
          return [...new Set(nonUniqueTags)]
        }
        return []
      },
    },
  })

  // Step 2. Fetch Collections for the Select filter
  const assetsListParams = {
    q: COMMON_QUERIES.c,
    limit: 200,
    ordering: 'name',
  }
  const { data: collectionOptions } = useAssetsList(assetsListParams, {
    query: {
      queryKey: getAssetsListQueryKey(assetsListParams),
      select: (response) => {
        if (!response?.data?.results) return []
        return response.data.results.map((c: Asset) => ({
          value: c.uid,
          label: c.name || t('Unnamed collection'),
        }))
      },
    },
  })

  // Step 3. Fetch Main Assets List
  function getAssetsListQuery() {
    const queryParts: string[] = []

    // Include search phrase
    if (debouncedSearch) {
      queryParts.push(`(${debouncedSearch})`)
    }

    // Include tags filtering
    if (selectedTags.length > 0) {
      // BUG: this doesn't work correctly - it does filter one tag, but if multiple are selected it returns zero values
      // See: https://linear.app/kobotoolbox/issue/DEV-1581/make-it-possible-to-filter-assets-by-multiple-tags
      const tagQuery = selectedTags.map((t) => `tags__name__icontains:"${t}"`).join(' AND ')
      queryParts.push(`(${tagQuery})`)
    }

    // Include filtering by collection (parent)
    if (selectedCollection) {
      queryParts.push(`parent__uid:"${selectedCollection}"`)
    }

    // Ensure we are only getting library items that make sense here (questions, blocks, and templates)
    queryParts.push(COMMON_QUERIES.qbt)

    return queryParts.join(' AND ')
  }
  const {
    data: assetsResponse,
    isLoading,
    isError,
  } = useAssetsList({
    q: getAssetsListQuery(),
    limit: 200,
    ordering: '-date_modified',
  })

  // Step 4. Setup drag and drop of found assets
  const assetsListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const foundEl = ReactDOM.findDOMNode(assetsListRef.current)
    if (foundEl instanceof Element === false) {
      return
    }

    var $el = $(foundEl)
    if ($el.hasClass('ui-sortable')) {
      $el.sortable('destroy')
    }
    $el.sortable({
      helper: 'clone',
      cursor: 'move',
      distance: 5,
      items: `> .${SORTABLE_ITEM_CLASS_NAME}`,
      connectWith: ['.survey-editor__list', '.group__rows'],
      opacity: 0.9,
      scroll: false,
      deactivate: () => {
        $el.sortable('cancel')
      },
    })
  }, [assetsResponse])

  return (
    <Stack gap='sm' h='100%'>
      {/* Searchbox */}
      <TextInput
        placeholder='Search…'
        leftSection={<Icon name='search' />}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
      />

      {/* Tags filtering */}
      <MultiSelect
        data={tagsOptions}
        value={selectedTags}
        onChange={setSelectedTags}
        placeholder='Filter by tags'
        searchable
        clearable
        nothingFoundMessage='No tags found'
        hidePickedOptions
        // HACKFIX: without this the list of options renders somewhere outside the viewport :sadface:
        comboboxProps={{ withinPortal: false }}
      />

      {/* Collection filtering */}
      <Select
        data={collectionOptions}
        value={selectedCollection}
        onChange={setSelectedCollection}
        placeholder='Select collection'
        searchable
        clearable
      />

      {/* Total count & toggle expanded info */}
      <Group justify='space-between' align='center'>
        <Text size='sm' fw={500}>
          {assetsResponse?.data.results?.length || 0} assets found
        </Text>

        <Checkbox
          label='Expand details'
          checked={isExpanded}
          onChange={(event) => setIsExpanded(event.currentTarget.checked)}
          size='sm'
        />
      </Group>

      {/* Results */}
      {isLoading ? (
        <Center py='xl'>
          <Loader size='sm' />
        </Center>
      ) : isError ? (
        <Center py='xl'>
          <Text c='red' size='sm'>
            Error loading assets
          </Text>
        </Center>
      ) : assetsResponse?.data.results?.length === 0 ? (
        <Center py='xl'>
          <Text size='sm'>No assets found</Text>
        </Center>
      ) : (
        <Stack gap='xs' ref={assetsListRef}>
          {assetsResponse?.data.results?.map((asset: Asset) => (
            <AssetNavigatorCard
              key={asset.uid}
              asset={asset}
              isExpanded={isExpanded}
              className={SORTABLE_ITEM_CLASS_NAME}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
