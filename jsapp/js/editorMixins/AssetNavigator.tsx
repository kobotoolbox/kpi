import { Center, Checkbox, Group, Loader, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import * as Sentry from '@sentry/react'
import React, { useState, useRef, useEffect } from 'react'
import type { Asset } from '#/api/models/asset'
import type { TagListResponse } from '#/api/models/tagListResponse'
import { useAssetsList, useTagsList } from '#/api/react-query/manage-projects-and-library-content'
import MultiSelect from '#/components/common/MultiSelect'
import Select from '#/components/common/Select'
import TextInput from '#/components/common/TextInput'
import Icon from '#/components/common/icon'
import { COMMON_QUERIES } from '#/constants'
import type { LabelValuePair } from '#/dataInterface'
import AssetNavigatorCard from './AssetNavigatorCard'
import { formatTagValue } from './assetNavigatorUtils'

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

// Past this the `q` search rejects the query; mirrors the back end's
// `QUERY_PARSER_MAX_TO_MANY_FILTERS`
const MAX_SELECTED_TAGS = 10

export default function AssetNavigator() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Step 1. Fetch Tags for the MultiSelect filter
  // Note: if `limit` is too big (e.g. `9999`) it causes a deadly timeout whenever Form Builder displays the aside
  // Library search, so we use `100`. We also keep track of users who have over 100 tags (see below).
  const tagsListQuery = useTagsList({ limit: 100 })

  let tagsOptions: string[] = []
  if (tagsListQuery.data?.status === 200) {
    const tagsOptionsRaw = tagsListQuery.data?.data?.results.map((tag: TagListResponse) => tag.name)
    // Because tags API has a bug we need to ensure only unique results are returned:
    // https://linear.app/kobotoolbox/issue/DEV-1576/duplicated-values-in-apiv2tags-endpoint
    // The endpoint has no `ordering` parameter, so we sort here to keep the picker browsable
    tagsOptions = [...new Set(tagsOptionsRaw)].sort((a, b) => a.localeCompare(b))
  }

  useEffect(() => {
    // We want to know if there are any users who have more than 100 tags. If there is `next` page of results, it
    // means we have more than 100 (the `limit` above)
    if (tagsListQuery.data?.status === 200 && typeof tagsListQuery.data?.data.next === 'string') {
      Sentry.captureMessage('MAX_TAGS_EXCEEDED: Too many tags')
    }
  }, [tagsListQuery.data])

  // Step 2. Fetch Collections for the Select filter
  const collectionListQuery = useAssetsList({
    q: COMMON_QUERIES.c,
    // TODO: we only fetch 200 collections, as this is what old code did. Ideally we should handle pagination.
    limit: 200,
    ordering: 'name',
  })
  let collectionOptions: LabelValuePair[] = []
  if (collectionListQuery.data?.status === 200 && collectionListQuery.data?.data.results) {
    collectionOptions = collectionListQuery.data.data.results.map((c: Asset) => {
      return {
        value: c.uid,
        label: c.name || t('Unnamed collection'),
      }
    })
  }

  // Step 3. Fetch Main Assets List
  function getAssetsListQuery() {
    const queryParts: string[] = []

    // Include search phrase
    if (debouncedSearch) {
      queryParts.push(`(${debouncedSearch})`)
    }

    // Include tags filtering.
    //
    // Uses `iexact`, not `icontains`: the names come from a list of tags that already exist,
    // so a partial match would silently pull in assets carrying a *different*, longer tag (picking "health" would
    // also match "health-services").
    //
    // Multiple tags are joined with `AND`, which the back end reads as "has every one of these".
    if (selectedTags.length > 0) {
      const tagQuery = selectedTags.map((tagName) => `tags__name__iexact:${formatTagValue(tagName)}`).join(' AND ')
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
  const assetsFoundCount = assetsResponse?.data.count || 0

  // Step 4. Setup drag and drop for library assets
  //
  // Makes library items draggable into FormBuilder. Drop targets are .survey-editor__list
  // (main survey) and .group__rows (groups). The receive handlers in view.surveyApp.coffee
  // catch the drop and call surveyScope.handleItem() to fetch and insert the asset.
  //
  // We call sortable('cancel') on deactivate so the item stays in the library after dragging
  // (it's a copy operation, not a move).
  const assetsListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const foundEl = assetsListRef.current
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
        aria-label={t('Search library')}
        placeholder={t('Search…')}
        leftSection={<Icon name='search' />}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
      />

      {/* Tags filtering */}
      <MultiSelect
        data={tagsOptions}
        value={selectedTags}
        onChange={setSelectedTags}
        aria-label={t('Filter by tags')}
        placeholder={t('Filter by tags')}
        maxValues={MAX_SELECTED_TAGS}
        // `maxValues` silently stops accepting picks, so say why once the limit is in reach
        description={
          selectedTags.length === MAX_SELECTED_TAGS
            ? t('You can filter by up to ##count## tags at a time').replace('##count##', String(MAX_SELECTED_TAGS))
            : undefined
        }
        searchable
        clearable
        nothingFoundMessage={t('No tags found')}
        hidePickedOptions
        size='md'
        selectFirstOptionOnChange
      />

      {/* Collection filtering */}
      <Select
        data={collectionOptions}
        value={selectedCollection}
        onChange={setSelectedCollection}
        aria-label={t('Filter by collection')}
        placeholder={t('Select collection')}
        searchable
        clearable
        size='md'
        selectFirstOptionOnChange
      />

      {/* Total count & toggle expanded info */}
      <Group justify='space-between' align='center'>
        <Text size='sm' fw={500}>
          {assetsFoundCount === 1
            ? t('1 asset found')
            : t('##count## assets found').replace('##count##', String(assetsFoundCount))}
        </Text>

        <Checkbox
          label={t('Expand details')}
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
            {t('Error loading assets')}
          </Text>
        </Center>
      ) : assetsResponse?.data.results?.length === 0 ? (
        <Center py='xl'>
          <Text size='sm'>{t('No assets found')}</Text>
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
