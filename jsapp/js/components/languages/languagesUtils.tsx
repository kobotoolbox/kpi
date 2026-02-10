import React, { useEffect, useState } from 'react'

import { recordKeys } from '#/utils'
import languagesStore from './languagesStore'
import type { LanguageCode } from './languagesStore'

/**
 * A simpler alternative to `AsyncLanguageDisplayLabel` for situations when you
 * already possess all necessary data.
 */
export function LanguageDisplayLabel(props: { code: LanguageCode; name: string }) {
  return (
    <span>
      {props.name}&nbsp;<small>({props.code})</small>
    </span>
  )
}

/**
 * Ultimately displays the same thing as `LanguageDisplayLabel`, but requires
 * only a single language code and fetches stuff in the background.
 * In reality it would rarely cause a backend call, as would mostly rely on
 * memoized data (an assumption).
 *
 * Displays provided `LanguageCode` as fallback mechanism.
 */
export function AsyncLanguageDisplayLabel(props: { code: LanguageCode }) {
  const [name, setName] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    getData()
  }, [props.code])

  async function getData() {
    setIsLoading(true)
    try {
      const foundName = await languagesStore.getLanguageName(props.code)
      setName(foundName)
      setIsLoading(false)
    } catch (error) {
      console.error(`Language ${props.code} not found 5`)
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <span>…</span>
  } else if (name) {
    return <LanguageDisplayLabel code={props.code} name={name} />
  } else {
    // Display code as fallback mechanism.
    return props.code
  }
}

/**
 * To be used when you need a string, and can't use `LanguageDisplayLabel` or
 * `AsyncLanguageDisplayLabel` (they both produce a `JSX.Element`).
 */
export function getLanguageDisplayLabel(name: string, code: LanguageCode) {
  return `${name} (${code})`
}

/** Checks if given language has any automated transcription services available. */
export async function hasTranscriptServicesAvailable(code: LanguageCode): Promise<boolean> {
  try {
    const language = await languagesStore.getLanguage(code)
    if (language) {
      return recordKeys(language.transcription_services).length >= 1
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

/** Checks if given language has any automated translation services available. */
export async function hasTranslationServicesAvailable(code: LanguageCode): Promise<boolean> {
  try {
    const language = await languagesStore.getLanguage(code)
    if (language) {
      return recordKeys(language.transcription_services).length >= 1
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}
