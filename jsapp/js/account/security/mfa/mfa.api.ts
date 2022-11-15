import { ROOT_URL } from "jsapp/js/constants"

export const getUserMethods = () => {
  return fetch(`${ROOT_URL}/api/v2/auth/mfa/user-methods/`).then((response) => response.json())
}
