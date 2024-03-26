/**
 * NOTE: all the actions groups definitions are both functions and objects with
 * nested functions.
 */

interface GenericDefinition extends Function {
  (a?: any, b?: any, c?: any, d?: any): void;
  started: GenericCallbackDefinition;
  completed: GenericCallbackDefinition;
  failed: GenericFailedDefinition;
}

interface GenericFailedDefinition extends Function {
  (response: FailResponse): void;
  listen: (callback: (response: FailResponse) => void) => Function;
}

interface GenericCallbackDefinition extends Function {
  (response: any): void;
  listen: (callback: (response: any) => void) => Function;
}

interface GetSubmissionDefinition extends Function {
  (assetUid: string, submissionIdOrUuid: string): void;
  completed: GetSubmissionCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface GetSubmissionCompletedDefinition extends Function {
  (response: SubmissionResponse): void;
  listen: (callback: (response: SubmissionResponse) => void) => Function;
}

interface GetProcessingSubmissionsArgs {
  assetUid: string;
  questionsPaths: string[];
  filters?: string | null;
  sort?: string | null;
  pageSize?: number | null;
  startIndex?: number | null;
}

interface GetProcessingSubmissionsDefinition extends Function {
  (args: GetProcessingSubmissionsArgs, refresh?: boolean): void;
  completed: GetProcessingSubmissionsCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface GetProcessingSubmissionsCompletedDefinition extends Function {
  (response: GetProcessingSubmissionsResponse): void;
  listen: (
    callback: (response: GetProcessingSubmissionsResponse) => void
  ) => Function;
}

interface LoadAssetDefinition extends Function {
  ({id: string}, refresh?: Boolean): void;
  completed: LoadAssetCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface LoadAssetCompletedDefinition extends Function {
  (response: AssetResponse): void;
  listen: (callback: (response: AssetResponse) => void) => Function;
}

interface DeleteAssetDefinition extends Function {
  (
    details: {uid: string; assetType: string},
    params?: {onComplete?: Function; onFail?: function}
  ): void;
  completed: DeleteAssetCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface DeleteAssetCompletedDefinition extends Function {
  (response: AssetResponse): void;
  listen: (callback: (response: AssetResponse) => void) => Function;
}

interface UpdateAssetDefinition extends Function {
  (uid: string, values: any, params?: any): void;
  completed: UpdateAssetCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface UpdateAssetCompletedDefinition extends Function {
  (response: AssetResponse): void;
  listen: (callback: (response: AssetResponse) => void) => Function;
}

interface GetExportDefinition extends Function {
  (assetUid: string, exportUid: string): void;
  completed: GetExportCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface GetExportCompletedDefinition extends Function {
  (response: any): void;
  listen: (callback: (response: any) => void) => Function;
}

// NOTE: as you use more actions in your ts files, please extend this namespace,
// for now we are defining only the ones we need.
export namespace actions {
    const navigation: {
      routeUpdate: GenericCallbackDefinition;
    };
    const auth: {
      verifyLogin: {
        loggedin: GenericCallbackDefinition;
      };
      changePassword: GenericDefinition;
    };
    const survey: object;
    const search: object;
    const resources: {
      createImport: GenericDefinition;
      loadAsset: LoadAssetDefinition;
      deployAsset: GenericDefinition;
      setDeploymentActive: GenericDefinition;
      createSnapshot: GenericDefinition;
      cloneAsset: GenericDefinition;
      deleteAsset: DeleteAssetDefinition;
      listTags: GenericDefinition;
      createResource: GenericDefinition;
      updateAsset: UpdateAssetDefinition;
      updateSubmissionValidationStatus: GenericDefinition;
      removeSubmissionValidationStatus: GenericDefinition;
      deleteSubmission: GenericDefinition;
      duplicateSubmission: GenericDefinition;
      refreshTableSubmissions: GenericDefinition;
      getAssetFiles: GenericDefinition;
    };
    const hooks: object;
    const misc: object;
    const reports: object;
    const table: {
      updateSettings: (assetUid: string, newSettings: object) => void;
    };
    const map: object;
    const permissions: {
      getConfig: GenericDefinition;
      copyPermissionsFrom: GenericDefinition;
      removeAssetPermission: GenericDefinition;
      assignAssetPermission: GenericDefinition;
      bulkSetAssetPermissions: GenericDefinition;
      getAssetPermissions: GenericDefinition;
    };
    const help: {
      getInAppMessages: GenericDefinition;
      setMessageAcknowledged: GenericDefinition;
      setMessageReadTime: GenericDefinition;
    };
    const library: any;
    const submissions: {
      getSubmission: GetSubmissionDefinition;
      getSubmissionByUuid: GetSubmissionDefinition;
      getSubmissions: GenericDefinition;
      getProcessingSubmissions: GetProcessingSubmissionsDefinition;
      bulkDeleteStatus: GenericDefinition;
      bulkPatchStatus: GenericDefinition;
      bulkPatchValues: GenericDefinition;
      bulkDelete: GenericDefinition;
    };
    const media: object;
    const exports: {
      getExport: GetExportDefinition;
    };
    const dataShare: object;
}
