export type OrderDirection = 'ascending' | 'descending';

export const HOME_VIEW = {
  uid: 'kobo_my_projects',
  name: t('My Projects'),
}

export interface ProjectsFilterDefinition {
  fieldName?: ProjectFieldName;
  condition?: FilterConditionName;
  value?: string;
}

export type FilterConditionName = 'contains' | 'doesNotContain' | 'endsWith' |
'is' | 'isEmpty' | 'isNot' | 'isNotEmpty' | 'startsWith';
interface FilterConditionDefinition {
  name: FilterConditionName;
  label: string;
  requiresValue: boolean;
  // TODO: this is supposed to be used with the new endpoints to filter out fields
  filterRegex: string;
}
type FilterConditions = {[P in FilterConditionName]: FilterConditionDefinition};
export const FILTER_CONDITIONS: FilterConditions = {
  is: {
    name: 'is',
    label: t('Is'),
    requiresValue: true,
    filterRegex: '^phrase$',
  },
  isNot: {
    name: 'isNot',
    label: t('Is not'),
    requiresValue: true,
    filterRegex: '^(?!phrase$).*$',
  },
  contains: {
    name: 'contains',
    label: t('Contains'),
    requiresValue: true,
    filterRegex: '^.*phrase.*$',
  },
  doesNotContain: {
    name: 'doesNotContain',
    label: t('Does not contain'),
    requiresValue: true,
    filterRegex: '^(?!.*phrase).*$',
  },
  startsWith: {
    name: 'startsWith',
    label: t('Starts with'),
    requiresValue: true,
    filterRegex: '^phrase.*',
  },
  endsWith: {
    name: 'endsWith',
    label: t('Ends with'),
    requiresValue: true,
    filterRegex: '^.*phrase$',
  },
  isEmpty: {
    name: 'isEmpty',
    label: t('Is empty'),
    requiresValue: false,
    filterRegex: '^$',
  },
  isNotEmpty: {
    name: 'isNotEmpty',
    label: t('Is not empty'),
    requiresValue: false,
    filterRegex: '^.+$',
  },
};

export type ProjectFieldName = 'countries' | 'dateModified' |
'description' | 'languages' | 'name' | 'ownerEmail' | 'ownerFullName' |
'ownerOrganization' | 'ownerUsername' | 'sector' | 'status' | 'submissions';

export interface ProjectFieldDefinition {
  name: ProjectFieldName;
  label: string;
  /** Backend property name used for ordering and filtering. */
  propertyName?: string;
  /** The default order direction for this field. */
  defaultDirection?: OrderDirection;
  /** A path to asset property that holds the data. */
  filterPropertyPath?: string[];
}

type ProjectFields = {[P in ProjectFieldName]: ProjectFieldDefinition};
/**
 * A full list of available fields for projects. Order is important here, as it
 * influences the order these will be displayed in UI.
 */
export const PROJECT_FIELDS: ProjectFields = {
  /** NOTE: Regardless of user settings, name is always visible. */
  name: {
    name: 'name',
    label: t('Project name'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  description: {
    name: 'description',
    label: t('Description'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  status: {
    name: 'status',
    label: t('Status'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  ownerUsername: {
    name: 'ownerUsername',
    label: t('Owner username'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  ownerFullName: {
    name: 'ownerFullName',
    label: t('Owner full name'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  ownerEmail: {
    name: 'ownerEmail',
    label: t('Owner email'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  ownerOrganization: {
    name: 'ownerOrganization',
    label: t('Owner organization'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  dateModified: {
    name: 'dateModified',
    label: t('Date modified'),
    propertyName: 'date_modified',
    defaultDirection: 'descending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  sector: {
    name: 'sector',
    label: t('Sector'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  countries: {
    name: 'countries',
    label: t('Countries'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  languages: {
    name: 'languages',
    label: t('Languages'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
  submissions: {
    name: 'submissions',
    label: t('Submissions'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    filterPropertyPath: ['xxxxxx','yyyyy'],
  },
};

export const DEFAULT_PROJECT_FIELDS: ProjectFieldName[] = [
  'countries',
  'dateModified',
  'name',
  'ownerUsername',
  'status',
  'submissions',
];
