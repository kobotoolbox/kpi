export interface ProjectsFilterDefinition {
  fieldName?: FilterFieldName;
  condition?: FilterConditionName;
  value?: string;
}

export type FilterConditionName = 'contains' | 'doesNotContain' | 'endsWith' |
'is' | 'isEmpty' | 'isNot' | 'isNotEmpty' | 'startsWith';
interface FilterConditionDefinition {
  name: FilterConditionName;
  label: string;
  requiresValue: boolean;
}
type FilterConditions = {[P in FilterConditionName]: FilterConditionDefinition};
export const FILTER_CONDITIONS: FilterConditions = {
  is: {name: 'is', label: t('Is'), requiresValue: true},
  isNot: {name: 'isNot', label: t('Is not'), requiresValue: true},
  contains: {name: 'contains', label: t('Contains'), requiresValue: true},
  doesNotContain: {
    name: 'doesNotContain',
    label: t('Does not contain'),
    requiresValue: true,
  },
  startsWith: {
    name: 'startsWith',
    label: t('Starts with'),
    requiresValue: true,
  },
  endsWith: {name: 'endsWith', label: t('Ends with'), requiresValue: true},
  isEmpty: {name: 'isEmpty', label: t('Is empty'), requiresValue: false},
  isNotEmpty: {
    name: 'isNotEmpty',
    label: t('Is not empty'),
    requiresValue: false,
  },
};

export type FilterFieldName = 'countries' | 'dateDeployed' | 'dateModified' |
'description' | 'languages' | 'name' | 'ownerEmail' | 'ownerFullName' |
'ownerOrg' | 'ownerUsername' | 'sector' | 'status' | 'submissions';
interface FilterFieldDefinition {
  name: FilterFieldName;
  label: string;
}
type FilterFields = {[P in FilterFieldName]: FilterFieldDefinition};
export const FILTER_FIELDS: FilterFields = {
  name: {name: 'name', label: t('Project name')},
  description: {name: 'description', label: t('Description')},
  ownerUsername: {name: 'ownerUsername', label: t('Owner username')},
  ownerEmail: {name: 'ownerEmail', label: t('Owner email')},
  ownerFullName: {name: 'ownerFullName', label: t('Owner full name')},
  ownerOrg: {name: 'ownerOrg', label: t('Owner org')},
  sector: {name: 'sector', label: t('Sector')},
  countries: {name: 'countries', label: t('Countries')},
  submissions: {name: 'submissions', label: t('Submissions')},
  dateDeployed: {name: 'dateDeployed', label: t('Date deployed')},
  dateModified: {name: 'dateModified', label: t('Date modified')},
  languages: {name: 'languages', label: t('Languages')},
  status: {name: 'status', label: t('Status')},
};
