export interface ProjectsFilterDefinition {
  fieldName?: FilterFieldName;
  condition?: FilterConditionName;
  value?: string;
}

export enum FilterConditionName {
  is = 'is',
  isNot = 'isNot',
  contains = 'contains',
  doesNotContain = 'doesNotContain',
  startsWith = 'startsWith',
  endsWith = 'endsWith',
  isEmpty = 'isEmpty',
  isNotEmpty = 'isNotEmpty',
}
interface FilterConditionDefinition {
  name: FilterConditionName;
  label: string;
  requiresValue: boolean;
}
type FilterConditions = {[P in FilterConditionName]: FilterConditionDefinition};
export const FILTER_CONDITIONS: FilterConditions = {
  is: {
    name: FilterConditionName.is,
    label: t('Is'),
    requiresValue: true,
  },
  isNot: {
    name: FilterConditionName.isNot,
    label: t('Is not'),
    requiresValue: true,
  },
  contains: {
    name: FilterConditionName.contains,
    label: t('Contains'),
    requiresValue: true,
  },
  doesNotContain: {
    name: FilterConditionName.doesNotContain,
    label: t('Does not contain'),
    requiresValue: true,
  },
  startsWith: {
    name: FilterConditionName.startsWith,
    label: t('Starts with'),
    requiresValue: true,
  },
  endsWith: {
    name: FilterConditionName.endsWith,
    label: t('Ends with'),
    requiresValue: true,
  },
  isEmpty: {
    name: FilterConditionName.isEmpty,
    label: t('Is empty'),
    requiresValue: false,
  },
  isNotEmpty: {
    name: FilterConditionName.isNotEmpty,
    label: t('Is not empty'),
    requiresValue: false,
  },
};

export enum FilterFieldName {
  name = 'name',
  description = 'description',
  ownerUsername = 'ownerUsername',
  ownerEmail = 'ownerEmail',
  ownerFullName = 'ownerFullName',
  ownerOrg = 'ownerOrg',
  sector = 'sector',
  countries = 'countries',
  submissions = 'submissions',
  dateDeployed = 'dateDeployed',
  dateModified = 'dateModified',
  languages = 'languages',
  status = 'status',
}
interface FilterFieldDefinition {
  name: FilterFieldName;
  label: string;
}
type FilterFields = {[P in FilterFieldName]: FilterFieldDefinition};
export const FILTER_FIELDS: FilterFields = {
  name: {name: FilterFieldName.name, label: t('Project name')},
  description: {name: FilterFieldName.description, label: t('Description')},
  ownerUsername: {name: FilterFieldName.ownerUsername, label: t('Owner username')},
  ownerEmail: {name: FilterFieldName.ownerEmail, label: t('Owner email')},
  ownerFullName: {name: FilterFieldName.ownerFullName, label: t('Owner full name')},
  ownerOrg: {name: FilterFieldName.ownerOrg, label: t('Owner org')},
  sector: {name: FilterFieldName.sector, label: t('Sector')},
  countries: {name: FilterFieldName.countries, label: t('Countries')},
  submissions: {name: FilterFieldName.submissions, label: t('Submissions')},
  dateDeployed: {name: FilterFieldName.dateDeployed, label: t('Date deployed')},
  dateModified: {name: FilterFieldName.dateModified, label: t('Date modified')},
  languages: {name: FilterFieldName.languages, label: t('Languages')},
  status: {name: FilterFieldName.status, label: t('Status')},
};
