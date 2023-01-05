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

// NOTE: if you plan to add a condition, make sure to re-check
// `availableFilters` for each field definition.
export type FilterConditionName =
  | 'contains'
  | 'doesNotContain'
  | 'endsWith'
  | 'is'
  | 'isEmpty'
  // *Object conditions are for sector, language, and countries fields
  | 'isEmptyObject'
  | 'isNot'
  | 'isNotEmpty'
  | 'isNotEmptyObject'
  | 'startsWith';
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
  isEmptyObject: {
    name: 'isEmptyObject',
    label: t('Is empty'),
    requiresValue: false,
    filterQuery: '<field>__iexact:{}',
  },
  isNotEmpty: {
    name: 'isNotEmpty',
    label: t('Is not empty'),
    requiresValue: false,
    filterQuery: 'NOT <field>:""',
  },
  isNotEmptyObject: {
    name: 'isNotEmptyObject',
    label: t('Is not empty'),
    requiresValue: false,
    filterQuery: 'NOT <field>__iexact:{}',
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

export type ProjectFieldName =
  | 'countries'
  | 'dateDeployed'
  | 'dateModified'
  | 'description'
  | 'languages'
  | 'name'
  | 'ownerEmail'
  | 'ownerFullName'
  | 'ownerOrganization'
  | 'ownerUsername'
  | 'sector'
  | 'status'
  | 'submissions';

export interface ProjectFieldDefinition {
  name: ProjectFieldName;
  label: string;
  /** Backend property name used for ordering and filtering. */
  apiPropertyName: string;
  /** Some of the fields (e.g. `submission`) doesn't allow any filtering yet. */
  availableConditions: FilterConditionName[];
  /** Some of the fields (e.g. `submission`) doesn't allow being ordered by. */
  orderable: boolean;
}

type ProjectFields = {[P in ProjectFieldName]: ProjectFieldDefinition};
/**
 * A full list of available fields for projects. Order is important here, as it
 * influences the order these will be displayed in UI.
 */
export const PROJECT_FIELDS: ProjectFields = {
  /**
   * NOTE: Regardless of user settings, we should keep the name field column
   * always visible. We keep this comment here, as multiple places are ensuring
   * this condition is met.
   */
  name: {
    name: 'name',
    label: t('Project name'),
    apiPropertyName: 'name',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'is',
      'isNot',
      'startsWith',
    ],
    orderable: true,
  },
  description: {
    name: 'description',
    label: t('Description'),
    apiPropertyName: 'settings__description',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'is',
      'isEmpty',
      'isNot',
      'isNotEmpty',
      'startsWith',
    ],
    orderable: true,
  },
  status: {
    name: 'status',
    label: t('Status'),
    apiPropertyName: '_deployment_data',
    availableConditions: [],
    orderable: false,
  },
  ownerUsername: {
    name: 'ownerUsername',
    label: t('Owner username'),
    apiPropertyName: 'owner__username',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'is',
      'isNot',
      'startsWith',
    ],
    orderable: true,
  },
  ownerFullName: {
    name: 'ownerFullName',
    label: t('Owner full name'),
    apiPropertyName: 'owner__extra_details__data__name',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'is',
      'isEmpty',
      'isNot',
      'isNotEmpty',
      'startsWith',
    ],
    orderable: true,
  },
  ownerEmail: {
    name: 'ownerEmail',
    label: t('Owner email'),
    apiPropertyName: 'owner__email',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'is',
      'isEmpty',
      'isNot',
      'isNotEmpty',
      'startsWith',
    ],
    orderable: true,
  },
  ownerOrganization: {
    name: 'ownerOrganization',
    label: t('Owner organization'),
    apiPropertyName: 'owner__extra_details__data__organization',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'is',
      'isEmpty',
      'isNot',
      'isNotEmpty',
      'startsWith',
    ],
    orderable: true,
  },
  dateModified: {
    name: 'dateModified',
    label: t('Date modified'),
    apiPropertyName: 'date_modified__date',
    availableConditions: [
      'contains',
      'doesNotContain',
      'endsWith',
      'startsWith',
    ],
    orderable: true,
  },
  dateDeployed: {
    name: 'dateDeployed',
    label: t('Date deployed'),
    apiPropertyName: 'date_deployed__date',
    availableConditions: [],
    orderable: false,
  },
  sector: {
    name: 'sector',
    label: t('Sector'),
    apiPropertyName: 'settings__sector',
    availableConditions: [
      'contains',
      'doesNotContain',
      'isEmptyObject',
      'isNotEmptyObject',
    ],
    orderable: true,
  },
  countries: {
    name: 'countries',
    label: t('Countries'),
    apiPropertyName: 'settings__country_codes[]',
    availableConditions: [
      'contains',
      'doesNotContain',
      'is',
      'isEmptyObject',
      'isNot',
      'isNotEmptyObject',
    ],
    orderable: true,
  },
  languages: {
    name: 'languages',
    label: t('Languages'),
    apiPropertyName: 'summary__languages[]',
    availableConditions: [
      'contains',
      'doesNotContain',
      'is',
      'isEmptyObject',
      'isNot',
      'isNotEmptyObject',
    ],
    orderable: true,
  },
  submissions: {
    name: 'submissions',
    label: t('Submissions'),
    apiPropertyName: 'deployment__submission_count',
    availableConditions: [],
    orderable: false,
  },
};

export const DEFAULT_PROJECT_FIELDS: ProjectFieldName[] = [
  'countries',
  'dateModified',
  'dateDeployed',
  'name',
  'ownerUsername',
  'status',
  'submissions',
];
