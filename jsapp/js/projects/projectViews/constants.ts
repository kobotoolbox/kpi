export type OrderDirection = 'ascending' | 'descending';

export const HOME_VIEW = {
  uid: 'kobo_my_projects',
  name: t('My Projects'),
};

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
  filterQuery: string;
}
type FilterConditions = {[P in FilterConditionName]: FilterConditionDefinition};
export const FILTER_CONDITIONS: FilterConditions = {
  is: {
    name: 'is',
    label: t('Is'),
    requiresValue: true,
    filterQuery: '<field>__iexact:<term>',
  },
  isNot: {
    name: 'isNot',
    label: t('Is not'),
    requiresValue: true,
    filterQuery: 'NOT <field>__iexact:<term>',
  },
  contains: {
    name: 'contains',
    label: t('Contains'),
    requiresValue: true,
    filterQuery: '<field>__icontains:<term>',
  },
  doesNotContain: {
    name: 'doesNotContain',
    label: t('Does not contain'),
    requiresValue: true,
    filterQuery: 'NOT <field>__icontains:<term>',
  },
  startsWith: {
    name: 'startsWith',
    label: t('Starts with'),
    requiresValue: true,
    filterQuery: '<field>__istartswith:<term>',
  },
  endsWith: {
    name: 'endsWith',
    label: t('Ends with'),
    requiresValue: true,
    filterQuery: '<field>__iendswith:<term>',
  },
  isEmpty: {
    name: 'isEmpty',
    label: t('Is empty'),
    requiresValue: false,
    filterQuery: '<field>:""',
  },
  isNotEmpty: {
    name: 'isNotEmpty',
    label: t('Is not empty'),
    requiresValue: false,
    filterQuery: 'NOT <field>:""',
  },
};

/**
 * EXCEPTION: the `status` field is combined from different pieces of data thus
 * it needs these queries :sadface:
 */
export const STATUS_FILTER_QUERIES = {
  draft: '_deployment_data__iexact:{}',
  deployed: '_deployment_data__active:true',
  archived: '_deployment_data__active:false',
};

/**
 * EXCEPTION: Dates are special pieces of data and they can be filtered in
 * a meaningful way by using these queries.
 */
export const DATE_FILTER_QUERIES = {
  greaterThan: '<field>__gt:<YYYY-MM-DD>',
  greaterOrEqualThan: '<field>__gte:<YYYY-MM-DD>',
  lessThan: '<field>__lt:<YYYY-MM-DD>',
  lessOrEqualThan: '<field>__lte:<YYYY-MM-DD>',
  partOf: '<field>__regex:<YYYY-MM>',
};

export type ProjectFieldName = 'countries' | 'dateModified' |
'description' | 'languages' | 'name' | 'ownerEmail' | 'ownerFullName' |
'ownerOrganization' | 'ownerUsername' | 'sector' | 'status' | 'submissions';

export interface ProjectFieldDefinition {
  name: ProjectFieldName;
  label: string;
  /** Backend property name used for ordering and filtering. */
  propertyName: string;
  /** The default order direction for this field. */
  defaultDirection: OrderDirection;
  /** Some of the fields (submission) doesn't allow any filtering yet. */
  allowsFiltering: boolean;
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
    propertyName: 'name',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  description: {
    name: 'description',
    label: t('Description'),
    propertyName: 'settings__description',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  status: {
    name: 'status',
    label: t('Status'),
    propertyName: '_deployment_data',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  ownerUsername: {
    name: 'ownerUsername',
    label: t('Owner username'),
    propertyName: 'owner__username',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  ownerFullName: {
    name: 'ownerFullName',
    label: t('Owner full name'),
    propertyName: 'owner__extra_details__data__name',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  ownerEmail: {
    name: 'ownerEmail',
    label: t('Owner email'),
    propertyName: 'owner__email',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  ownerOrganization: {
    name: 'ownerOrganization',
    label: t('Owner organization'),
    propertyName: 'owner__extra_details__data__organization',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  dateModified: {
    name: 'dateModified',
    label: t('Date modified'),
    propertyName: 'date_modified__date',
    defaultDirection: 'descending',
    allowsFiltering: true,
  },
  sector: {
    name: 'sector',
    label: t('Sector'),
    propertyName: 'settings__sector',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  countries: {
    name: 'countries',
    label: t('Countries'),
    propertyName: 'settings__country_codes[]',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  languages: {
    name: 'languages',
    label: t('Languages'),
    propertyName: 'summary__languages[]',
    defaultDirection: 'ascending',
    allowsFiltering: true,
  },
  submissions: {
    name: 'submissions',
    label: t('Submissions'),
    propertyName: 'xxxx',
    defaultDirection: 'ascending',
    allowsFiltering: false,
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
