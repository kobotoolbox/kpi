import {t} from 'js/utils';

export const ASSETS_TABLE_CONTEXTS = new Map();
new Set([
  'my-library',
  'collection-content',
  'public-collections'
]).forEach((name) => {ASSETS_TABLE_CONTEXTS.set(name, name);});

export const ORDER_DIRECTIONS = new Map();
new Set([
  'ascending',
  'descending'
]).forEach((name) => {ORDER_DIRECTIONS.set(name, name);});

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
export const ASSETS_TABLE_COLUMNS = new Map([
  [
    'icon-status', {
      label: t('Type'),
      id: 'icon-status',
      orderBy: 'asset_type',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'date-modified', {
      label: t('Last Modified'),
      id: 'date-modified',
      orderBy: 'date_modified',
      defaultValue: ORDER_DIRECTIONS.get('descending')
    }
  ],
  [
    'name', {
      label: t('Name'),
      id: 'name',
      orderBy: 'name',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'owner', {
      label: t('Owner'),
      id: 'owner',
      orderBy: 'owner__username',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'subscribers-count', {
      label: t('Subscribers'),
      id: 'subscribers-count',
      orderBy: 'subscribers_count',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'languages', {
      label: t('Languages'),
      id: 'languages',
      filterBy: 'summary__languages',
      filterByPath: ['summary', 'languages'],
      filterByMetadataName: 'languages'
    }
  ],
  [
    'organization', {
      label: t('Organization'),
      id: 'organization',
      filterBy: 'settings__organization',
      filterByPath: ['settings', 'organization'],
      filterByMetadataName: 'organizations'
    }
  ],
  [
    'primary-sector', {
      label: t('Primary Sector'),
      id: 'primary-sector',
      filterBy: 'settings__sector__value',
      filterByPath: ['settings', 'sector'],
      filterByMetadataName: 'sectors'
    }
  ],
  [
    'country', {
      label: t('Country'),
      id: 'country',
      filterBy: 'settings__country__value',
      filterByPath: ['settings', 'country'],
      filterByMetadataName: 'countries'
    }
  ],
]);
