/**
 * Interface representing the state object held by the store.
 * Since init() sets this.state = {}, it's effectively a flexible dictionary.
 */
export interface SurveyStateStoreData {
  groupButtonIsActive?: boolean
  groupShrunk?: boolean
  multioptionsExpanded?: boolean
  [key: string]: any;
}

/**
 * Definition for the Reflux Store created via Reflux.createStore()
 */
export interface SurveyStateStore {
  /** The internal state object */
  state: SurveyStateStoreData;

  /** Initializes the store (called automatically by Reflux) */
  init(): void;

  /**
   * Updates the state and triggers the change event if the state has actually changed.
   * @param state A partial object containing the keys to update.
   */
  setState(state: Partial<SurveyStateStoreData>): void;

  /** * Reflux method: Triggers an event to all listeners.
   * In this implementation, it passes the 'changes' object.
   */
  trigger(changes: any): void;

  /**
   * Reflux method: specific to the older createStore syntax.
   * Allows components to listen to store updates.
   */
  listen(callback: (changes: any) => void): void;
}

// TODO: either change whole `stores.js` to `stores.ts` or crete a type
// definition for a store you need.
export namespace stores {
  const tags: any
  const surveyState: SurveyStateStore
  const assetSearch: any
  const translations: any
  const snapshots: any
  const session: {
    listen: (clb: Function) => void
    currentAccount: AccountResponse
    isAuthStateKnown: boolean
    isLoggedIn: boolean
  }
  const allAssets: any
}
