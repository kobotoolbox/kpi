export type OrderDirection = 'ascending' | 'descending';

export type ProjectsTableColumnName = 'date-modified' | 'icon-status' |
'items-count' | 'languages' | 'name' | 'owner';

export interface ProjectsTableColumn {
  label: string;
  id: ProjectsTableColumnName;
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

type ProjectsTableColumns = {
  readonly [id in ProjectsTableColumnName]: ProjectsTableColumn;
};

export const PROJECTS_TABLE_COLUMNS: ProjectsTableColumns = {
  'icon-status': {
    label: t('Type'),
    id: 'icon-status',
    orderBy: 'asset_type',
    defaultValue: 'ascending',
  },
  'date-modified': {
    label: t('Last Modified'),
    id: 'date-modified',
    orderBy: 'date_modified',
    defaultValue: 'descending',
  },
  name: {
    label: t('Name'),
    id: 'name',
    orderBy: 'name',
    defaultValue: 'ascending',
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
    defaultValue: 'ascending',
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
};
