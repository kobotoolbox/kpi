interface ActionDefinition extends Function {
  [index: string]: {
    listen: Function;
  };
}

// TODO: as you use more actions in your ts files, please extend this namespace
export namespace actions {
    const navigation: any;
    const auth: any;
    const survey: any;
    const search: any;
    const resources: any;
    const hooks: any;
    const misc: any;
    const reports: any;
    const table: any;
    const map: any;
    const permissions: any;
    const help: any;
    const library: any;
    const submissions: {
      getSubmission: ActionDefinition;
      getSubmissions: ActionDefinition;
      bulkDeleteStatus: ActionDefinition;
      bulkPatchStatus: ActionDefinition;
      bulkPatchValues: ActionDefinition;
      bulkDelete: ActionDefinition;
    };
    const media: any;
    const exports: any;
    const dataShare: any;
}
