export const INSIGHTZEN_MODULE_GROUPS = [
  {
    id: 'management',
    labelKey: 'management',
    panels: [
      { id: 'user-management', labelKey: 'userManagement', route: 'user-management' },
      { id: 'project-management', labelKey: 'projectManagement', route: 'project-management' },
      { id: 'database-management', labelKey: 'databaseManagement', route: 'database-management' },
      { id: 'quota-management', labelKey: 'quotaManagement', route: 'quota-management' },
    ],
  },
  {
    id: 'collection',
    labelKey: 'collection',
    panels: [
      { id: 'collection-management', labelKey: 'collectionManagement', route: 'collection-management' },
      { id: 'collection-performance', labelKey: 'collectionPerformance', route: 'collection-performance' },
      { id: 'telephone-interviewer', labelKey: 'telephoneInterviewer', route: 'telephone-interviewer' },
      { id: 'fieldwork-interviewer', labelKey: 'fieldworkInterviewer', route: 'fieldwork-interviewer' },
      { id: 'focus-group-panel', labelKey: 'focusGroupPanel', route: 'focus-group-panel' },
    ],
  },
  {
    id: 'quality-control',
    labelKey: 'qualityControl',
    panels: [
      { id: 'qc-management', labelKey: 'qcManagement', route: 'qc-management' },
      { id: 'qc-performance', labelKey: 'qcPerformance', route: 'qc-performance' },
      { id: 'voice-review', labelKey: 'voiceReview', route: 'voice-review' },
      { id: 'callback-qc', labelKey: 'callbackQc', route: 'callback-qc' },
      { id: 'coding', labelKey: 'coding', route: 'coding' },
      { id: 'statistical-health-check', labelKey: 'statisticalHealthCheck', route: 'statistical-health-check' },
    ],
  },
  {
    id: 'mranalysis',
    labelKey: 'mranalysis',
    panels: [
      { id: 'tabulation', labelKey: 'tabulation', route: 'tabulation' },
      { id: 'statistics', labelKey: 'statistics', route: 'statistics' },
      { id: 'funnel-analysis', labelKey: 'funnelAnalysis', route: 'funnel-analysis' },
      { id: 'conjoint-analysis', labelKey: 'conjointAnalysis', route: 'conjoint-analysis' },
      { id: 'segmentation-analysis', labelKey: 'segmentationAnalysis', route: 'segmentation-analysis' },
    ],
  },
] as const

export type InsightZenPanelRoute = (typeof INSIGHTZEN_MODULE_GROUPS)[number]['panels'][number]['route']

export const PERMISSION_TREE = {
  collection: {
    labelKey: 'collection',
    children: {
      quota: 'quotaManagement',
      performance: 'collectionPerformance',
      telephone: 'telephoneInterviewer',
      fieldwork: 'fieldworkInterviewer',
      focus_group: 'focusGroupPanel',
    },
  },
  quality: {
    labelKey: 'qualityControl',
    children: {
      qc_management: 'qcManagement',
      qc_performance: 'qcPerformance',
      voice_review: 'voiceReview',
      callback_qc: 'callbackQc',
      coding: 'coding',
      statistical_health_check: 'statisticalHealthCheck',
    },
  },
  admin: {
    labelKey: 'management',
    children: {
      user_mgmt: 'userManagement',
      project_mgmt: 'projectManagement',
      database_mgmt: 'databaseManagement',
      quota_mgmt: 'quotaManagement',
    },
  },
} as const satisfies Record<string, { labelKey: string; children: Record<string, string> }>

export const ROLE_OPTIONS = [
  { value: 'admin', labelKey: 'admin' },
  { value: 'manager', labelKey: 'manager' },
  { value: 'supervisor', labelKey: 'supervisor' },
  { value: 'agent', labelKey: 'agent' },
  { value: 'viewer', labelKey: 'viewer' },
]

export const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'active' },
  { value: 'paused', labelKey: 'paused' },
  { value: 'archived', labelKey: 'archived' },
]
