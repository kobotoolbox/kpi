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

export type ProjectFieldName = 'countries' | 'dateDeployed' | 'dateModified' |
'description' | 'languages' | 'name' | 'ownerEmail' | 'ownerFullName' |
'ownerOrganisation' | 'ownerUsername' | 'sector' | 'status' | 'submissions';
interface FilterFieldDefinition {
  name: ProjectFieldName;
  label: string;
}
type ProjectFields = {[P in ProjectFieldName]: FilterFieldDefinition};
export const PROJECT_FIELDS: ProjectFields = {
  name: {name: 'name', label: t('Project name')},
  description: {name: 'description', label: t('Description')},
  ownerUsername: {name: 'ownerUsername', label: t('Owner username')},
  ownerEmail: {name: 'ownerEmail', label: t('Owner email')},
  ownerFullName: {name: 'ownerFullName', label: t('Owner full name')},
  ownerOrganisation: {name: 'ownerOrganisation', label: t('Owner organisation')},
  sector: {name: 'sector', label: t('Sector')},
  countries: {name: 'countries', label: t('Countries')},
  submissions: {name: 'submissions', label: t('Submissions')},
  dateDeployed: {name: 'dateDeployed', label: t('Date deployed')},
  dateModified: {name: 'dateModified', label: t('Date modified')},
  languages: {name: 'languages', label: t('Languages')},
  status: {name: 'status', label: t('Status')},
};
