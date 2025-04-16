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
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse) => void) => Function
}

interface UpdateAssetDefinition extends Function {
  (uid: string, values: any, params?: any): void
  completed: UpdateAssetCompletedDefinition
  failed: GenericFailedDefinition
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
  failed: GenericFailedDefinition
}

interface SetAssetPublicCompletedDefinition extends Function {
  (assetUid: string, shouldSetAnonPerms: boolean): void
  listen: (callback: (assetUid: string, shouldSetAnonPerms: boolean) => void) => Function
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

// NOTE: as you use more actions in your ts files, please extend this namespace,
// for now we are defining only the ones we need.
export namespace actions {
  const navigation: {
    routeUpdate: GenericCallbackDefinition
  }
  const auth: {
    verifyLogin: {
      loggedin: GenericCallbackDefinition
    }
    changePassword: GenericDefinition
  }
  const survey: object
  const search: object
  const resources: {
    createImport: GenericDefinition
    loadAsset: LoadAssetDefinition
    deployAsset: GenericDefinition
    setDeploymentActive: GenericDefinition
    createSnapshot: GenericDefinition
    cloneAsset: GenericDefinition
    deleteAsset: DeleteAssetDefinition
    listTags: GenericDefinition
    createResource: GenericDefinition
    updateAsset: UpdateAssetDefinition
    updateSubmissionValidationStatus: UpdateSubmissionValidationStatusDefinition
    removeSubmissionValidationStatus: RemoveSubmissionValidationStatusDefinition
    deleteSubmission: GenericDefinition
    duplicateSubmission: DuplicateSubmissionDefinition
    refreshTableSubmissions: GenericDefinition
    getAssetFiles: ResourcesGetAssetFilesDefinition
  }
  const hooks: {
    add: GenericDefinition
    update: GenericDefinition
    delete: GenericDefinition
    getAll: GenericDefinition
    getLogs: HooksGetLogsDefinition
    retryLog: GenericDefinition
    retryLogs: GenericDefinition
  }
  const misc: {
    getUser: GetUserDefinition
  }
  const reports: {
    setStyle: ReportsSetStyleDefinition
    setCustom: ReportsSetCustomDefinition
  }
  const table: {
    updateSettings: TableUpdateSettingsDefinition
  }
  const map: {
    setMapStyles: MapSetMapStylesDefinition
  }
  const permissions: {
    getConfig: GenericDefinition
    copyPermissionsFrom: GenericDefinition
    removeAssetPermission: GenericDefinition
    assignAssetPermission: GenericDefinition
    bulkSetAssetPermissions: GenericDefinition
    getAssetPermissions: GenericDefinition
    setAssetPublic: SetAssetPublicDefinition
  }
  const help: {
    getInAppMessages: GenericDefinition
    setMessageAcknowledged: GenericDefinition
    setMessageReadTime: GenericDefinition
  }
  const library: any
  const submissions: {
    getSubmission: GetSubmissionDefinition
    getSubmissionByUuid: GetSubmissionDefinition
    getSubmissions: GetSubmissionsDefinition
    getProcessingSubmissions: GetProcessingSubmissionsDefinition
    bulkDeleteStatus: GenericDefinition
    bulkPatchStatus: GenericDefinition
    bulkPatchValues: GenericDefinition
    bulkDelete: GenericDefinition
  }
  const media: object
  const exports: {
    getExport: GetExportDefinition
    getExports: GenericDefinition
    createExport: GenericDefinition
    deleteExport: GenericDefinition
    getExportSettings: GetExportSettingsDefinition
    updateExportSetting: GenericDefinition
    createExportSetting: GenericDefinition
    deleteExportSetting: GenericDefinition
  }
  const dataShare: object
}
