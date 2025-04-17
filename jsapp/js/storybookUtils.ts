/**
 * To be used inside storybook test (inside `play` function) to wait for an API call to finish between actions.
 * For example, `await sleep(2000)`
 * @param ms - milliseconds to wait
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
