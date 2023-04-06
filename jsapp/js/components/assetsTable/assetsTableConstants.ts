import {createEnum} from 'js/constants';
import type {OrderDirection} from 'js/projects/projectViews/constants';

export enum AssetsTableContextName {
  MY_LIBRARY = 'MY_LIBRARY',
  COLLECTION_CONTENT = 'COLLECTION_CONTENT',
  PUBLIC_COLLECTIONS = 'PUBLIC_COLLECTIONS',
}

export const ASSETS_TABLE_CONTEXTS = createEnum([
  AssetsTableContextName.MY_LIBRARY,
  AssetsTableContextName.COLLECTION_CONTENT,
  AssetsTableContextName.PUBLIC_COLLECTIONS,
]);

export const ORDER_DIRECTIONS: {[id in OrderDirection]: OrderDirection} = {
  ascending: 'ascending',
  descending: 'descending',
};

export type AssetsTableColumnName = 'date-modified' | 'icon-status' | 'items-count' | 'languages' | 'name' | 'owner' | 'primary-sector' | 'subscribers-count';

export interface AssetsTableColumn {
  label: string;
  id: AssetsTableColumnName;
  /** a backend order property */
  orderBy?: string | null;
  defaultValue?: OrderDirection | null;
  /** a backend filter property */
  filterBy?: string;
  /** a path to asset property that holds the data */
  filterByPath?: string[];
  /** name of the metadata property that holds the values for the filter */
  filterByMetadataName?: string;
}

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
    // NOTE: currently it is not possible to order by summary.row_count and children.count at the same time
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
});
