import type { AccountFieldsValues } from '#/account/account.constants'
import type { IconName } from '#/k-icons'
import { PROJECTS_ROUTES, ROUTES } from '#/router/routerConstants'

export interface ModulePanelDefinition {
  id: string
  label: string
}

export interface ModuleDefinition {
  id: string
  label: string
  icon: IconName
  baseRoute: string
  panels: ModulePanelDefinition[]
  requiresOrganizational: boolean
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: 'form-manager',
    label: t('Form Manager'),
    icon: 'projects',
    baseRoute: PROJECTS_ROUTES.MY_PROJECTS,
    panels: [],
    requiresOrganizational: false,
  },
  {
    id: 'library',
    label: t('Library'),
    icon: 'library',
    baseRoute: ROUTES.LIBRARY,
    panels: [],
    requiresOrganizational: false,
  },
  {
    id: 'management',
    label: t('Management'),
    icon: 'settings',
    baseRoute: ROUTES.INSIGHTZEN_ROOT,
    panels: [
      { id: 'user-management', label: t('User Management') },
      { id: 'project-management', label: t('Project Management') },
      { id: 'database-management', label: t('Database Management') },
      { id: 'quota-management', label: t('Quota Management') },
    ],
    requiresOrganizational: true,
  },
  {
    id: 'collection',
    label: t('Collection'),
    icon: 'group',
    baseRoute: ROUTES.COLLECTION,
    panels: [
      { id: 'collection-management', label: t('Collection Management') },
      { id: 'collection-performance', label: t('Collection Performance') },
      { id: 'telephone-interviewer', label: t('Telephone Interviewer') },
      { id: 'fieldwork-interviewer', label: t('Fieldwork Interviewer') },
      { id: 'focus-group-panel', label: t('Focus Group Panel') },
    ],
    requiresOrganizational: true,
  },
  {
    id: 'quality-control',
    label: t('Quality Control'),
    icon: 'check-circle',
    baseRoute: ROUTES.QUALITY_CONTROL,
    panels: [
      { id: 'qc-management', label: t('QC Management') },
      { id: 'qc-performance', label: t('QC Performance') },
      { id: 'voice-review', label: t('Voice Review') },
      { id: 'callback-qc', label: t('Callback QC') },
      { id: 'coding', label: t('Coding') },
      { id: 'statistical-health-check', label: t('Statistical Health Check') },
    ],
    requiresOrganizational: true,
  },
  {
    id: 'mranalysis',
    label: t('MRAnalysis'),
    icon: 'reports',
    baseRoute: ROUTES.MR_ANALYSIS,
    panels: [
      { id: 'tabulation', label: t('Tabulation') },
      { id: 'statistics', label: t('Statistics') },
      { id: 'funnel-analysis', label: t('Funnel Analysis') },
      { id: 'conjoint-analysis', label: t('Conjoint Analysis') },
      { id: 'segmentation-analysis', label: t('Segmentation Analysis') },
    ],
    requiresOrganizational: true,
  },
]

export function canAccessModule(extraDetails: AccountFieldsValues | undefined, moduleId: string): boolean {
  const allowedModules = extraDetails?.allowed_modules
  if (Array.isArray(allowedModules)) {
    return allowedModules.includes(moduleId)
  }

  const accountType = extraDetails?.account_type
  const paymentStatus = extraDetails?.payment_status
  if (moduleId === 'form-manager' || moduleId === 'library') {
    return true
  }
  if (!accountType) {
    return true
  }
  if (accountType === 'organizational' && paymentStatus !== 'pending') {
    return true
  }

  return false
}

export function getModuleById(moduleId: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((module) => module.id === moduleId)
}
