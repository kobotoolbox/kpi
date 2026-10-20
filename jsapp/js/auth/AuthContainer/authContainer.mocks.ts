/**
 * Sets the `login-background-url` meta tag (as in `index.html`). Without it a story renders our own
 * background until `/environment` lands, which is the flash the meta tag exists to prevent.
 */
export function setLoginBackgroundMetaForStories(url: string) {
  return () => {
    const meta = document.createElement('meta')
    meta.name = 'login-background-url'
    meta.content = url
    document.head.append(meta)

    // Cleanup
    return () => meta.remove()
  }
}
