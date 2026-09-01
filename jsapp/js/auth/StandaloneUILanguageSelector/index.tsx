import { type FloatingPosition, VisuallyHidden } from '@mantine/core'
import { IconCheck, IconLoader2, IconWorld } from '@tabler/icons-react'
import cx from 'classnames'
import { useState } from 'react'
import {
  type environmentRetrieveResponse,
  getEnvironmentRetrieveQueryKey,
  useEnvironmentRetrieve,
} from '#/api/react-query/configuration'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import { currentLang } from '#/utils'
import styles from './StandaloneUILanguageSelector.module.scss'
import { useSetUILanguage } from './useSetUILanguage'

interface UILanguage {
  /** A Django language code, e.g. `fr` or `zh-hans`. */
  code: string
  /** The language's name in that language, e.g. `français`. */
  label: string
}

/**
 * Finds the language the interface is currently displayed in.
 *
 * Needs to be lenient about regions: the cookie can hold a regional code (`LocaleMiddleware` writes
 * `en-us` for our default `LANGUAGE_CODE`) while the server only offers base ones (`en`), so an
 * exact match is tried first and the base language second.
 */
function findCurrentLanguage(languages: UILanguage[], currentCode: string) {
  const baseCode = (code: string) => code.toLowerCase().split('-')[0]
  return (
    languages.find((language) => language.code.toLowerCase() === currentCode.toLowerCase()) ??
    languages.find((language) => baseCode(language.code) === baseCode(currentCode))
  )
}

export interface StandaloneUILanguageSelectorProps {
  /**
   * Use over an admin-uploaded background (the `login_background` configuration file), which is a
   * photo darkened for legibility, and so needs the light-on-dark treatment.
   */
  hasCustomBackground?: boolean
  /**
   * Called once the server has stored the new language.
   * By default we reload the page, use this to override that behaviour.
   */
  onLanguageChanged?: (languageCode: string) => void
  className?: string
  position?: FloatingPosition
}

/**
 * A dropdown for switching the language the interface is displayed in. Standalone, i.e. it stands on
 * the page by itself rather than being a section of a bigger menu - for the screens that have no
 * navigation to put it in (the authentication and error views). The logged in app offers the same
 * choice inside `#/components/header/accountMenu.tsx`.
 *
 * Works for anonymous visitors, which is the whole point - see {@link useSetUILanguage} for how the
 * choice is stored and why it survives logging in.
 *
 * The toggle button shows the current language as a two letter abbreviation (there is no room for
 * more in the corner of a page), while the dropdown lists the full names, each in its own language.
 */
export default function StandaloneUILanguageSelector(props: StandaloneUILanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const setLanguageMutation = useSetUILanguage()

  const languagesQuery = useEnvironmentRetrieve({
    query: {
      queryKey: getEnvironmentRetrieveQueryKey(),
      select: (response: environmentRetrieveResponse) =>
        (response.data.interface_languages ?? []).map(([code, label]) => {
          return { code, label }
        }),
    },
  })

  const languages = languagesQuery.data ?? []

  const currentCode = currentLang()
  const currentLanguage = findCurrentLanguage(languages, currentCode)

  const errorMessage = t('Could not change the language. Please try again.')

  const handleLanguageClick = (languageCode: string) => {
    if (setLanguageMutation.isPending) {
      return
    }

    setLanguageMutation.mutate(languageCode, {
      onSuccess: () => {
        setIsOpen(false)
        if (props.onLanguageChanged) {
          props.onLanguageChanged(languageCode)
        } else {
          window.location.reload()
        }
      },
    })
  }

  // Covers the request still being in flight, having failed, and servers configured with a single
  // language (`DJANGO_LANGUAGE_CODES`) - in all three cases the dropdown would be a dead end, so we
  // stay out of the layout instead of offering a broken control.
  if (languages.length < 2) {
    return null
  }

  return (
    <>
      <Menu
        opened={isOpen}
        onChange={setIsOpen}
        position={props.position || 'bottom-end'}
        zIndex={KOBO_Z_INDEX.dropdown}
      >
        <Menu.Target>
          <button
            type='button'
            className={cx(
              styles.toggle,
              { [styles['toggle--onCustomBackground']]: props.hasCustomBackground },
              props.className,
            )}
            aria-label={t('Interface language: ##language##').replace(
              '##language##',
              currentLanguage?.label ?? currentCode,
            )}
          >
            <KoboIcon icon={IconWorld} size='xs' />
            {/* Only show two letters */}
            {currentCode.slice(0, 2).toUpperCase()}
          </button>
        </Menu.Target>

        <Menu.Dropdown className={styles.dropdown}>
          {languages.map((language) => {
            const isCurrent = language.code === currentLanguage?.code
            const isBeingSet = setLanguageMutation.isPending && setLanguageMutation.variables === language.code

            let rightSection: React.ReactNode
            if (isBeingSet) {
              rightSection = <KoboIcon icon={IconLoader2} size='xs' className='k-spin' />
            } else if (isCurrent) {
              rightSection = <KoboIcon icon={IconCheck} size='xs' />
            }

            return (
              <Menu.Item
                key={language.code}
                // For screen readers
                lang={language.code}
                // Keeping the dropdown open leaves somewhere to put the pending and failed states.
                closeMenuOnClick={false}
                aria-current={isCurrent || undefined}
                aria-busy={isBeingSet || undefined}
                rightSection={rightSection}
                onClick={() => handleLanguageClick(language.code)}
              >
                {language.label}
              </Menu.Item>
            )
          })}

          {setLanguageMutation.isError && <Menu.Label c='red.5'>{errorMessage}</Menu.Label>}
        </Menu.Dropdown>
      </Menu>

      {/* Error message for screen readers */}
      <VisuallyHidden role='status'>{setLanguageMutation.isError ? errorMessage : ''}</VisuallyHidden>
    </>
  )
}
