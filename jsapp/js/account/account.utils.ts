import type {AccountFieldsValues} from "./accountFieldsEditor.component";

export function getInitialAccountFieldsValues(): AccountFieldsValues {
  return {
    name: '',
    organization: '',
    organization_website: '',
    sector: '',
    gender: '',
    bio: '',
    city: '',
    country: '',
    require_auth: false,
    twitter: '',
    linkedin: '',
    instagram: '',
  }
}
