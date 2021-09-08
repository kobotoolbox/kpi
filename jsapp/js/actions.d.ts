/**
 * NOTE: all the actions groups definitions are both functions and objects with
 * nested functions.
 */

interface GetSubmissionDefinition extends Function {
  (assetUid: string, submissionId: string): void
  completed: GetSubmissionCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetSubmissionCompletedDefinition extends Function {
  (response: SubmissionResponse): void
  listen: (callback: (response: SubmissionResponse) => void) => Function
}

interface GetSubmissionsIdsDefinition extends Function {
  (assetUid: string): void
  completed: GetSubmissionsIdsCompletedDefinition
  failed: GenericFailedDefinition
}

interface GetSubmissionsIdsCompletedDefinition extends Function {
  (response: GetSubmissionsIdsResponse): void
  listen: (callback: (response: GetSubmissionsIdsResponse) => void) => Function
}

interface LoadAssetDefinition extends Function {
  (params: {id: string}): void
  completed: LoadAssetCompletedDefinition
  failed: GenericFailedDefinition
}

interface LoadAssetCompletedDefinition extends Function {
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse) => void) => Function
}

interface GenericFailedDefinition extends Function {
  (response: FailResponse): void
  listen: (callback: (response: FailResponse) => void) => Function
}

interface UpdateAssetDefinition extends Function {
  (uid: string, values: any, params: any): void
  completed: UpdateAssetCompletedDefinition
  failed: GenericFailedDefinition
}

interface UpdateAssetCompletedDefinition extends Function {
  (response: AssetResponse): void
  listen: (callback: (response: AssetResponse) => void) => Function
}

// TODO: as you use more actions in your ts files, please extend this namespace
export namespace actions {
    const navigation: any
    const auth: any
    const survey: any
    const search: any
    const resources: {
      createImport: any
      loadAsset: LoadAssetDefinition
      deployAsset: any
      setDeploymentActive: any
      createSnapshot: any
      cloneAsset: any
      deleteAsset: any
      listTags: any
      createResource: any
      updateAsset: UpdateAssetDefinition
      updateSubmissionValidationStatus: any
      removeSubmissionValidationStatus: any
      deleteSubmission: any
      duplicateSubmission: any
      refreshTableSubmissions: any
      getAssetFiles: any
    }
    const hooks: any
    const misc: any
    const reports: any
    const table: any
    const map: any
    const permissions: any
    const help: any
    const library: any
    const submissions: {
      getSubmission: GetSubmissionDefinition
      getSubmissions: any
      getSubmissionsIds: GetSubmissionsIdsDefinition
      bulkDeleteStatus: any
      bulkPatchStatus: any
      bulkPatchValues: any
      bulkDelete: any
    }
    const media: any
    const exports: any
    const dataShare: any
}
