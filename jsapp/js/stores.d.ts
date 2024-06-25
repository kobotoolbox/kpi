// TODO: either change whole `stores.es6` to `stores.ts` or crete a type
// definition for a store you need.
export namespace stores {
  const tags: any;
  const surveyState: any;
  const assetSearch: any;
  const translations: any;
  const snapshots: any;
  const session: {
    listen: (clb: Function) => void;
    currentAccount: AccountResponse;
    isAuthStateKnown: boolean;
    isLoggedIn: boolean;
  };
  const allAssets: any;
}
