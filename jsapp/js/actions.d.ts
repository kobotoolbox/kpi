interface GetSubmissionDefinition extends Function {
  (assetUid: string, submissionId: string): void
  completed: {
    listen: (callback: (response: SubmissionResponse) => void) => void
  }
  failed: {
    listen: (callback: (response: FailResponse) => void) => void
  }
}

// TODO: as you use more actions in your ts files, please extend this namespace
export namespace actions {
    const navigation: any
    const auth: any
    const survey: any
    const search: any
    const resources: any
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
      bulkDeleteStatus: any
      bulkPatchStatus: any
      bulkPatchValues: any
      bulkDelete: any
    }
    const media: any
    const exports: any
    const dataShare: any
}
