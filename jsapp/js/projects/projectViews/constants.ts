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
  },
  status: {
    name: 'status',
    label: t('Status'),
    apiPropertyName: '_deployment_data__active',
    availableConditions: [],
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
  },
  dateDeployed: {
    name: 'dateDeployed',
    label: t('Date deployed'),
    apiPropertyName: 'date_deployed__date',
    availableConditions: [],
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
  },
  submissions: {
    name: 'submissions',
    label: t('Submissions'),
    apiPropertyName: 'deployment__submission_count',
    availableConditions: [],
  },
};

/**
 * The fields that the `/api/v2/project-views/<uid>/assets/` endpoint is able
 * to order the data by. AKA the default orderable fields.
 */
export const DEFAULT_ORDERABLE_FIELDS: ProjectFieldName[] = [
  'dateDeployed',
  'dateModified',
  'description',
  'name',
  'ownerEmail',
  'ownerFullName',
  'ownerOrganization',
  'ownerUsername',
  'sector',
  'status',
];

/**
 * The fields that the `/api/v2/assets/` endpoint can order the data by. AKA
 * the orderable fields for the "My Projects" route.
 */
export const HOME_ORDERABLE_FIELDS: ProjectFieldName[] = [
  'dateModified',
  'name',
  'ownerUsername',
];

export const DEFAULT_VISIBLE_FIELDS: ProjectFieldName[] = [
  'countries',
  'dateModified',
  'dateDeployed',
  'name',
  'ownerUsername',
  'status',
  'submissions',
];
