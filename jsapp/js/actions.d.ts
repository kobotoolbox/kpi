/**
 * NOTE: all the actions groups definitions are both functions and objects with
 * nested functions.
 */

interface GetSubmissionDefinition extends Function {
  (assetUid: string, submissionIdOrUuid: string): void;
  completed: GetSubmissionCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface GetSubmissionCompletedDefinition extends Function {
  (response: SubmissionResponse): void;
  listen: (callback: (response: SubmissionResponse) => void) => Function;
}

interface GetProcessingSubmissionsDefinition extends Function {
  (assetUid: string, questionsPaths: string[]): void;
  completed: GetProcessingSubmissionsCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface GetProcessingSubmissionsCompletedDefinition extends Function {
  (response: GetProcessingSubmissionsResponse): void;
  listen: (callback: (response: GetProcessingSubmissionsResponse) => void) => Function;
}

interface GetEnvironmentDefinition extends Function {
  (): void;
  completed: GetEnvironmentCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface GetEnvironmentCompletedDefinition extends Function {
  (response: EnvironmentResponse): void;
  listen: (callback: (response: EnvironmentResponse) => void) => Function;
}

interface LoadAssetDefinition extends Function {
  (params: {id: string}): void;
  completed: LoadAssetCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface LoadAssetCompletedDefinition extends Function {
  (response: AssetResponse): void;
  listen: (callback: (response: AssetResponse) => void) => Function;
}

interface DeleteAssetDefinition extends Function {
  (params: {id: string}): void;
  completed: DeleteAssetCompletedDefinition;
  failed: GenericFailedDefinition;
}

interface DeleteAssetCompletedDefinition extends Function {
  (response: AssetResponse): void;
  listen: (callback: (response: AssetResponse) => void) => Function;
}

interface GenericFailedDefinition extends Function {
  (response: FailResponse): void;
  listen: (callback: (response: FailResponse) => void) => Function;
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

// TODO: as you use more actions in your ts files, please extend this namespace
export namespace actions {
    const navigation: object;
    const auth: {
      getEnvironment: GetEnvironmentDefinition;
    };
    const survey: object;
    const search: object;
    const resources: {
      createImport: Function;
      loadAsset: LoadAssetDefinition;
      deployAsset: Function;
      setDeploymentActive: Function;
      createSnapshot: Function;
      cloneAsset: Function;
      deleteAsset: DeleteAssetDefinition;
      listTags: Function;
      createResource: Function;
      updateAsset: UpdateAssetDefinition;
      updateSubmissionValidationStatus: Function;
      removeSubmissionValidationStatus: Function;
      deleteSubmission: Function;
      duplicateSubmission: Function;
      refreshTableSubmissions: Function;
      getAssetFiles: Function;
    }
    const hooks: object;
    const misc: object;
    const reports: object;
    const table: {
      updateSettings: (assetUid: string, newSettings: object) => void
    }
    const map: object;
    const permissions: object;
    const help: object;
    const library: object;
    const submissions: {
      getSubmission: GetSubmissionDefinition;
      getSubmissionByUuid: GetSubmissionDefinition;
      getSubmissions: Function;
      getProcessingSubmissions: GetProcessingSubmissionsDefinition;
      bulkDeleteStatus: Function;
      bulkPatchStatus: Function;
      bulkPatchValues: Function;
      bulkDelete: Function;
    }
    const media: object;
    const exports: object;
    const dataShare: object;
}
