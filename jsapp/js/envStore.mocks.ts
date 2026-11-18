import { runInAction } from 'mobx'
import { expect, waitFor } from 'storybook/test'
import envStore, { type EnvStoreData } from './envStore'

/**
 * Puts `/environment` fields on the `envStore` singleton for a story, and returns the teardown for them.
 *
 * Mocking the endpoint cannot reach this store, which is why this exists alongside `environment.mocks.ts`: the store
 * fetches once when it is imported, before any story's handlers are installed, and never refetches. Use
 * `makeEnvironmentMock` for anything reading `/environment` through react-query instead.
 *
 * The `waitFor` is not optional: that one fetch overwrites anything seeded before it lands.
 */
export const seedEnvStore = (fields: Partial<EnvStoreData>) => async () => {
  await waitFor(() => expect(envStore.isReady).toBe(true)).catch(() => {})

  const keys = Object.keys(fields) as Array<keyof EnvStoreData>
  const original = Object.fromEntries(keys.map((key) => [key, envStore.data[key]]))
  const wasReady = envStore.isReady

  runInAction(() => {
    envStore.isReady = true
    Object.assign(envStore.data, fields)
  })

  return () => {
    runInAction(() => {
      envStore.isReady = wasReady
      Object.assign(envStore.data, original)
    })
  }
}
