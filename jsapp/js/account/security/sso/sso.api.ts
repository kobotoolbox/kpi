import { fetchDelete } from '#/api'

const LIST_URL = '/me/social-accounts/'

export async function deleteSocialAccount(provider: string, uid: string) {
  return fetchDelete(`${LIST_URL}${provider}/${uid}/`)
}
