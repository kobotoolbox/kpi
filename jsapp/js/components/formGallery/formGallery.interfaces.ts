/** Represents a JavaScript object that was parsed from JSON */
export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
