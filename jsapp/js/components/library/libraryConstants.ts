import {createEnum} from 'js/constants'

export const ROOT_BREADCRUMBS = Object.freeze({
  PROJECTS: {
    label: t('Projects'),
    href: '#/forms',
  },
  MY_LIBRARY: {
    label: t('My Library'),
    href: '#/library/my-library',
  },
  PUBLIC_COLLECTIONS: {
    label: t('Public Collections'),
    href: '#/library/public-collections',
  },
})

export const ASSETS_TABLE_CONTEXTS = createEnum([
  'MY_LIBRARY',
  'COLLECTION_CONTENT',
  'PUBLIC_COLLECTIONS',
])

export type OrderDirection = 'ascending' | 'descending'

export const ORDER_DIRECTIONS: {[id in OrderDirection]: OrderDirection} = {
  ascending: 'ascending',
  descending: 'descending'
}

export type AssetsTableColumnName = 'icon-status' | 'date-modified' | 'name' | 'items-count' | 'owner' | 'subscribers-count' | 'languages' | 'primary-sector'

export interface AssetsTableColumn {
  label: string
  id: AssetsTableColumnName
  orderBy?: string | null
  defaultValue?: OrderDirection | null
  filterBy?: string
  filterByPath?: string[]
  filterByMetadataName?: string
}

/**
 * @typedef AssetsTableColumn
 * @prop {string} label
 * @prop {string} id
 * @prop {string} [filterBy] - a backend filter property
 * @prop {string} [filterByPath] - a path to asset property that holds the data
 * @prop {string} [filterByMetadataName] - name of the metadata property that holds the values for the filter
 * @prop {string} [orderBy] - a backend order property
 * @prop {boolean} [defaultValue]
 */
export const ASSETS_TABLE_COLUMNS: {[id: string]: AssetsTableColumn} = Object.freeze({
  'icon-status': {
    label: t('Type'),
    id: 'icon-status',
    orderBy: 'asset_type',
    defaultValue: ORDER_DIRECTIONS.ascending,
  },
  'date-modified': {
    label: t('Last Modified'),
    id: 'date-modified',
    orderBy: 'date_modified',
    defaultValue: ORDER_DIRECTIONS.descending,
  },
  name: {
    label: t('Name'),
    id: 'name',
    orderBy: 'name',
    defaultValue: ORDER_DIRECTIONS.ascending,
  },
  'items-count': {
    label: t('Items'),
    id: 'items-count',
    // TODO: currently it is not possible to order by summary.row_count and children.count at the same time
    // so we disable this column
    orderBy: null,
    defaultValue: null,
  },
  owner: {
    label: t('Owner'),
    id: 'owner',
    orderBy: 'owner__username',
    defaultValue: ORDER_DIRECTIONS.ascending,
  },
  'subscribers-count': {
    label: t('Subscribers'),
    id: 'subscribers-count',
    orderBy: 'subscribers_count',
    defaultValue: ORDER_DIRECTIONS.ascending,
  },
  languages: {
    label: t('Languages'),
    id: 'languages',
    filterBy: 'summary__languages__icontains',
    filterByPath: ['summary', 'languages'],
    filterByMetadataName: 'languages',
  },
  'primary-sector': {
    label: t('Primary Sector'),
    id: 'primary-sector',
    filterBy: 'settings__sector__value',
    filterByPath: ['settings', 'sector'],
    filterByMetadataName: 'sectors',
  },
})
