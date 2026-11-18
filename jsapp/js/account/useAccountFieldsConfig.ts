import type { environmentRetrieveResponse } from '#/api/react-query/configuration'
import { useEnvironmentQuery } from '#/api/useEnvironmentQuery'
import { getAccountFieldsConfig } from './account.utils'

const selectAccountFieldsConfig = (response: environmentRetrieveResponse) => getAccountFieldsConfig(response.data)

/**
 * The profile field configuration `AccountFieldsEditor` renders from: which fields this instance asks for, their
 * labels, and the country and sector choices.
 */
export function useAccountFieldsConfig() {
  return useEnvironmentQuery({ select: selectAccountFieldsConfig })
}
