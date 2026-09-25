import { AccountConfigurationLoginMethodsItem as LoginMethod } from '#/api/models/accountConfigurationLoginMethodsItem'

/** Which credential the sign-in form asks for, following the login methods this server accepts. */
export type LoginCredential = 'username' | 'email' | 'usernameOrEmail'

/** `null` when there is nothing safe to ask for: no methods yet, or only `phone`, which has no field here. */
export function getLoginCredential(loginMethods: LoginMethod[] | undefined): LoginCredential | null {
  if (!loginMethods) {
    return null
  }
  const acceptsUsername = loginMethods.includes(LoginMethod.username)
  const acceptsEmail = loginMethods.includes(LoginMethod.email)

  if (acceptsUsername && acceptsEmail) {
    return 'usernameOrEmail'
  }
  if (acceptsUsername) {
    return 'username'
  }
  return acceptsEmail ? 'email' : null
}

/**
 * The field name allauth reads the credential from, and reports errors about. It takes exactly one, so
 * either kind goes as `username`: allauth resolves that by address first when addresses are accepted too.
 */
export function getLoginCredentialParam(credential: LoginCredential): 'username' | 'email' {
  return credential === 'email' ? 'email' : 'username'
}
