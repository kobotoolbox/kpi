import type { Survey } from '../../xlform/src/model.survey'
import type { AssetResponse, FailResponse } from './dataInterface'

/**
 * NOTE: all the actions groups definitions are both functions and objects with
 * nested functions.
 */

interface GenericDefinition extends Function {
  (a?: any, b?: any, c?: any, d?: any): void
  started: GenericCallbackDefinition
  completed: GenericCallbackDefinition
  failed: GenericFailedDefinition
  listen: (callback: () => void) => Function
}

interface GenericFailedDefinition extends Function {
  (response: FailResponse): void
  listen: (callback: (response: FailResponse) => void) => Function
}

interface GenericCallbackDefinition extends Function {
  (response: any): void
  listen: (callback: (response: any) => void) => Function
}

interface GetSubmissionDefinition extends Function {
  (assetUid: string, submissionIdOrUuid: string): void
  completed: GetSubmissionCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetSubmissionCompletedDefinition extends Function {
  (response: SubmissionResponse): void
  listen: (callback: (response: SubmissionResponse) => void) => Function
}

interface GetSubmissionsDefinition extends Function {
  (options: GetSubmissionsOptions): void
  completed: GetSubmissionsCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetSubmissionsCompletedDefinition extends Function {
  (response: PaginatedResponse<SubmissionResponse>, options: GetSubmissionsOptions): void
  listen: (
    callback: (response: PaginatedResponse<SubmissionResponse>, options: GetSubmissionsOptions) => void,
  ) => Function
}

interface GetProcessingSubmissionsDefinition extends Function {
  (assetUid: string, questionsPaths: string[]): void
  completed: GetProcessingSubmissionsCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetProcessingSubmissionsCompletedDefinition extends Function {
  (response: GetProcessingSubmissionsResponse): void
  listen: (callback: (response: GetProcessingSubmissionsResponse) => void) => Function
}

interface LoadAssetDefinition extends Function {
  ({ id: string }, refresh?: Boolean): void
  completed: LoadAssetCompletedDefinition
  failed: GenericFailedDefinition
}

interface LoadAssetCompletedDefinition extends Function {
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse) => void) => Function
}

interface DeleteAssetDefinition extends Function {
  (details: { uid: string; assetType: string }, params?: { onComplete?: Function; onFail?: function }): void
  completed: DeleteAssetCompletedDefinition
  failed: GenericFailedDefinition
}

interface DeleteAssetCompletedDefinition extends Function {
  (response: { uid: string; assetType: AssetTypeName }): void
  listen: (callback: (response: { uid: string; assetType: AssetTypeName }) => void) => Function
}

export interface UpdateAssetDefinitionParams {
  onComplete?: (response: AssetResponse) => void
  onFailed?: (response: FailResponse) => void
}

interface UpdateAssetDefinition extends Function {
  (uid: string, values: Partial<AssetRequestObject>, params?: UpdateAssetDefinitionParams): void
  completed: UpdateAssetCompletedDefinition
  failed: GenericFailedDefinition
  triggerAsync: (uid: string, values: any, params?: UpdateAssetDefinitionParams) => Promise
}

interface UpdateAssetCompletedDefinition extends Function {
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse) => void) => Function
}

interface GetExportDefinition extends Function {
  (assetUid: string, exportUid: string): void
  completed: GetExportCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetExportCompletedDefinition extends Function {
  (response: ExportDataResponse): void
  listen: (callback: (response: ExportDataResponse) => void) => Function
}

interface GetExportSettingsDefinition extends Function {
  (assetUid: string, options: { preselectLastSettings: boolean }): void
  completed: GetExportSettingsCompletedDefinition
  failed: GenericFailedDefinition
}
interface GetExportSettingsCompletedDefinition extends Function {
  (response: PaginatedResponse<ExportSetting>, passData: {}): void
  listen: (
    callback: (response: PaginatedResponse<ExportSetting>, passData?: { preselectLastSettings?: boolean }) => void,
  ) => Function
}

interface TableUpdateSettingsDefinition extends Function {
  (assetUid: string, newSettings: object): void
  completed: GenericCallbackDefinition
  failed: GenericFailedDefinition
}

interface UpdateSubmissionValidationStatusDefinition extends Function {
  (assetUid: string, submissionUid: string, data: { 'validation_status.uid': ValidationStatus }): void
  completed: AnySubmissionValidationStatusCompletedDefinition
  failed: GenericFailedDefinition
}

interface AnySubmissionValidationStatusCompletedDefinition extends Function {
  (result: ValidationStatusResponse, sid: string): void
  listen: (callback: (result: ValidationStatusResponse, sid: string) => void) => Function
}

interface RemoveSubmissionValidationStatusDefinition extends Function {
  (assetUid: string, submissionUid: string): void
  completed: AnySubmissionValidationStatusCompletedDefinition
  failed: GenericFailedDefinition
}

interface ResourcesGetAssetFilesDefinition extends Function {
  (assetId: string, fileType: AssetFileType): void
  completed: ResourcesGetAssetFilesCompletedDefinition
  failed: GenericFailedDefinition
}
interface ResourcesGetAssetFilesCompletedDefinition extends Function {
  (response: PaginatedResponse<AssetFileResponse>): void
  listen: (callback: (response: PaginatedResponse<AssetFileResponse>) => void) => Function
}

interface ResourcesGetAssetFilesDefinition extends Function {
  (assetId: string, fileType: AssetFileType): void
  completed: ResourcesGetAssetFilesCompletedDefinition
  failed: GenericFailedDefinition
}
interface ResourcesGetAssetFilesCompletedDefinition extends Function {
  (response: PaginatedResponse<AssetFileResponse>): void
  listen: (callback: (response: PaginatedResponse<AssetFileResponse>) => void) => Function
}

interface DuplicateSubmissionDefinition extends Function {
  (assetUid: string, submissionUid: string, data: SubmissionResponse): void
  completed: DuplicateSubmissionCompletedDefinition
  failed: GenericFailedDefinition
}

interface DuplicateSubmissionCompletedDefinition extends Function {
  (assetUid: string, submissionUid: string, duplicatedSubmission: SubmissionResponse): void
  listen: (
    callback: (assetUid: string, submissionUid: string, duplicatedSubmission: SubmissionResponse) => void,
  ) => Function
}

interface GetUserDefinition extends Function {
  (username: string): void
  completed: GetUserCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetUserCompletedDefinition extends Function {
  (response: AccountResponse): void
  listen: (callback: (response: AccountResponse) => void) => Function
}

interface SetAssetPublicDefinition extends Function {
  (asset: AssetResponse, shouldSetAnonPerms: boolean): void
  completed: SetAssetPublicCompletedDefinition
  failed: SetAssetPublicFailedDefinition
}
interface SetAssetPublicCompletedDefinition extends Function {
  (assetUid: string, shouldSetAnonPerms: boolean): void
  listen: (callback: (assetUid: string, shouldSetAnonPerms: boolean) => void) => Function
}
interface SetAssetPublicFailedDefinition extends Function {
  (assetUid: string): void
  listen: (callback: (assetUid: string) => void) => Function
}

interface RemoveAssetPermissionDefinition extends Function {
  (
    assetUid: string,
    perm: string | undefined,
    removeAll: boolean | undefined,
    isNonOwner: boolean | undefined,
    username: string | undefined,
  ): void
  completed: RemoveAssetPermissionCompletedDefinition
  failed: GenericFailedDefinition
}
interface RemoveAssetPermissionCompletedDefinition extends Function {
  (assetUid: string, isNonOwner: boolean | undefined): void
  listen: (callback: (assetUid: string, isNonOwner: boolean | undefined) => void) => Function
}

interface ReportsSetStyleDefinition extends Function {
  (assetId: string, details: AssetResponseReportStyles): void
  listen: (callback: (assetId: string, details: AssetResponseReportStyles) => void) => Function
  completed: ReportsSetStyleCompletedDefinition
  failed: GenericFailedDefinition
}

interface ReportsSetStyleCompletedDefinition extends Function {
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse) => void) => Function
}

interface ReportsSetCustomDefinition extends Function {
  (assetId: string, details: { [crid: string]: CustomReport }, crid: string): void
  listen: (callback: (assetId: string, details: { [crid: string]: CustomReport }, crid: string) => void) => Function
  completed: ReportsSetCustomCompletedDefinition
  failed: GenericFailedDefinition
}

interface ReportsSetCustomCompletedDefinition extends Function {
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse, crid: string) => void) => Function
}

interface MapSetMapStylesDefinition extends Function {
  (assetUid: string, newMapSettings: AssetMapStyles): void
  listen: (callback: (assetUid: string, newMapSettings: AssetMapStyles) => void) => Function
  started: MapSetMapStylesStartedDefinition
  completed: GenericCallbackDefinition
  failed: GenericFailedDefinition
}
interface HooksGetLogsDefinition extends Function {
  (
    assetUid: string,
    hookUid: string,
    options: {
      onComplete: (data: PaginatedResponse<HookResponse>) => void
      onFail: () => void
    },
  ): void
  listen: (
    callback: (
      assetUid: string,
      hookUid: string,
      options: {
        onComplete: (data: PaginatedResponse<HookResponse>) => void
        onFail: () => void
      },
    ) => void,
  ) => Function
  completed: HooksGetLogsCompletedDefinition
  failed: GenericFailedDefinition
}
interface HooksGetLogsCompletedDefinition extends Function {
  (response: PaginatedResponse<HookResponse>): void
  listen: (callback: (response: PaginatedResponse<HookResponse>) => void) => Function
}

interface MapSetMapStylesDefinition extends Function {
  (assetUid: string, newMapSettings: AssetMapStyles): void
  listen: (callback: (assetUid: string, newMapSettings: AssetMapStyles) => void) => Function
  started: MapSetMapStylesStartedDefinition
  completed: GenericCallbackDefinition
  failed: GenericFailedDefinition
}
interface MapSetMapStylesStartedDefinition extends Function {
  (assetUid: string, upcomingMapSettings: AssetMapStyles): void
  listen: (callback: (assetUid: string, upcomingMapSettings: AssetMapStyles) => void) => Function
}

interface CreateResourceDefinition extends Function {
  (params: Partial<AssetRequestObject>): void
  completed: CreateResourceCompletedDefinition
  failed: GenericFailedDefinition
  triggerAsync: (params: Partial<AssetRequestObject>) => Promise
}
interface CreateResourceCompletedDefinition extends Function {
  (response: any): void
  listen: (callback: (response: any) => void) => Function
}

interface SurveyAddExternalItemParams {
  position: number
  uid: string
  survey: Survey
  groupId: string | undefined
}
interface SurveyAddExternalItemDefinition extends Function {
  (params: SurveyAddExternalItemParams): void
  completed: SurveyAddExternalItemCompletedDefinition
  failed: GenericFailedDefinition
  triggerAsync: (params: SurveyAddExternalItemParams) => Promise
}
interface SurveyAddExternalItemCompletedDefinition extends Function {
  (response: any): void
  listen: (callback: (response: any) => void) => Function
}

interface UnsubscribeFromCollectionDefinition extends Function {
  (assetUid: string): void
  listen: (callback: (assetUid: string) => void) => Function
  completed: UnsubscribeFromCollectionCompletedDefinition
  failed: GenericFailedDefinition
}
interface UnsubscribeFromCollectionCompletedDefinition extends Function {
  (response: any): void
  listen: (callback: (response: any) => void) => Function
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
export declare const actions: {
  navigation: {
    routeUpdate: GenericCallbackDefinition
  }
  auth: {
    verifyLogin: {
      loggedin: GenericCallbackDefinition
    }
    changePassword: GenericDefinition
  }
  survey: {
    addExternalItemAtPosition: SurveyAddExternalItemDefinition
  }
  search: object
  resources: {
    createImport: GenericDefinition
    loadAsset: LoadAssetDefinition
    deployAsset: GenericDefinition
    /** This is "archive" and "unarchive" of asset */
    setDeploymentActive: GenericDefinition
    createSnapshot: GenericDefinition
    cloneAsset: GenericDefinition
    deleteAsset: DeleteAssetDefinition
    createResource: CreateResourceDefinition
    updateAsset: UpdateAssetDefinition
    updateSubmissionValidationStatus: UpdateSubmissionValidationStatusDefinition
    removeSubmissionValidationStatus: RemoveSubmissionValidationStatusDefinition
    deleteSubmission: GenericDefinition
    duplicateSubmission: DuplicateSubmissionDefinition
    refreshTableSubmissions: GenericDefinition
    getAssetFiles: ResourcesGetAssetFilesDefinition
  }
  hooks: {
    add: GenericDefinition
    update: GenericDefinition
    delete: GenericDefinition
    getAll: GenericDefinition
    getLogs: HooksGetLogsDefinition
    retryLog: GenericDefinition
    retryLogs: GenericDefinition
  }
  misc: {
    getUser: GetUserDefinition
  }
  reports: {
    setStyle: ReportsSetStyleDefinition
    setCustom: ReportsSetCustomDefinition
  }
  table: {
    updateSettings: TableUpdateSettingsDefinition
  }
  map: {
    setMapStyles: MapSetMapStylesDefinition
  }
  permissions: {
    getConfig: GenericDefinition
    copyPermissionsFrom: GenericDefinition
    removeAssetPermission: RemoveAssetPermissionDefinition
    assignAssetPermission: GenericDefinition
    bulkSetAssetPermissions: GenericDefinition
    getAssetPermissions: GenericDefinition
    setAssetPublic: SetAssetPublicDefinition
  }
  help: {
    getInAppMessages: GenericDefinition
    setMessageAcknowledged: GenericDefinition
    setMessageReadTime: GenericDefinition
  }
  library: {
    getCollections: GenericDefinition
    moveToCollection: GenericDefinition
    subscribeToCollection: GenericDefinition
    unsubscribeFromCollection: UnsubscribeFromCollectionDefinition
    searchMyCollectionAssets: GenericDefinition
    searchMyCollectionMetadata: GenericDefinition
    searchMyLibraryAssets: GenericDefinition
    searchMyLibraryMetadata: GenericDefinition
    searchPublicCollections: GenericDefinition
    searchPublicCollectionsMetadata: GenericDefinition
  }
  submissions: {
    getSubmission: GetSubmissionDefinition
    getSubmissionByUuid: GetSubmissionDefinition
    getSubmissions: GetSubmissionsDefinition
    getProcessingSubmissions: GetProcessingSubmissionsDefinition
    bulkDeleteStatus: GenericDefinition
    bulkPatchStatus: GenericDefinition
    bulkPatchValues: GenericDefinition
    bulkDelete: GenericDefinition
  }
  media: object
  exports: {
    getExport: GetExportDefinition
    getExports: GenericDefinition
    createExport: GenericDefinition
    deleteExport: GenericDefinition
    getExportSettings: GetExportSettingsDefinition
    updateExportSetting: GenericDefinition
    createExportSetting: GenericDefinition
    deleteExportSetting: GenericDefinition
  }
  dataShare: {
    attachToSource: GenericDefinition
    detachSource: GenericDefinition
    getAttachedSources: GenericDefinition
    getSharingEnabledAssets: GenericDefinition
    patchSource: GenericDefinition
    toggleDataSharing: GenericDefinition
    updateColumnFilters: GenericDefinition
  }
}
