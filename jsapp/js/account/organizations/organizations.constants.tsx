export interface Organization {
    id: string;
    name: string;
    is_active: boolean;
    created: string;
    modified: string;
    slug: string;
    is_owner: boolean;
  }

export enum OrgMemberRole {
'MEMBER' = 'member',
'ADMIN' = 'admin',
'OWNER' = 'owner'
}
