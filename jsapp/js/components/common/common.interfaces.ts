/** Represents a JavaScript object that was parsed from JSON */
export type Json =
  | Json[]
  | boolean
  | number
  | string
  | {[key: string]: Json}
  | null;
