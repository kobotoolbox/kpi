import { IconLogout, IconWorldFilled } from '@tabler/icons-react'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import bem from '#/bem'
import Menu from '#/components/common/Menu'
import Avatar from '#/components/common/avatar'
import type { LabelValuePair } from '#/dataInterface'
import { dataInterface } from '#/dataInterface'
import envStore from '#/envStore'
import { isAnyRouteBlockerActive } from '#/router/routerUtils'
import sessionStore from '#/stores/session'
import { currentLang } from '#/utils'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import ButtonNew from '../common/ButtonNew'
import OrganizationBadge from './organizationBadge.component'

/**
 * UI element that display things only for logged-in user. An avatar that gives
 * access to a menu that allows language change, logging out and few other
 * things.
 *
 * Note: this displays a simplified content for user with invalidated password.
 */
export default function AccountMenu() {
  const [isLanguageSelectorVisible, setIsLanguageSelectorVisible] = useState<boolean>(false)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  const toggleLanguageSelector = () => {
    setIsLanguageSelectorVisible(!isLanguageSelectorVisible)
  }

  const shouldDisplayUrls =
    (typeof envStore.data.terms_of_service_url === 'string' && envStore.data.terms_of_service_url !== '') ||
    (typeof envStore.data.privacy_policy_url === 'string' && envStore.data.privacy_policy_url !== '')

  let langs: LabelValuePair[] = []
  if (envStore.isReady && envStore.data.interface_languages) {
    langs = envStore.data.interface_languages
  }

  const onLanguageChange = (langCode: string) => {
    if (langCode) {
      // use .always (instead of .done) here since Django 1.8 redirects the request
      dataInterface.setLanguage({ language: langCode }).always(() => {
        if ('reload' in window.location) {
          window.location.reload()
        } else {
          window.alert(t('Please refresh the page'))
        }
      })
    }
  }

  const renderLangItem = (lang: LabelValuePair) => {
    const currentLanguage = currentLang()
    return (
      <bem.AccountBox__menuLI key={lang.value}>
        <bem.AccountBox__menuLink onClick={() => onLanguageChange(lang.value)}>
          {lang.value === currentLanguage && <strong>{lang.label}</strong>}
          {lang.value !== currentLanguage && lang.label}
        </bem.AccountBox__menuLink>
      </bem.AccountBox__menuLI>
    )
  }

  if (!sessionStore.isLoggedIn) {
    return null
  }

  const accountName = sessionStore.currentAccount.username
  const accountEmail = 'email' in sessionStore.currentAccount ? sessionStore.currentAccount.email : ''

  return (
    <bem.AccountBox>
      <Menu opened={isMenuOpen} onChange={setIsMenuOpen} zIndex={KOBO_Z_INDEX.accountMenu}>
        <Menu.Target>
          <button type='button' className='account-menu-trigger'>
            <Avatar size='m' username={accountName} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          <bem.AccountBox__menu>
            <bem.AccountBox__menuLI key='1'>
              <bem.AccountBox__menuItem m={'avatar'}>
                <Avatar size='m' username={accountName} fullName={accountName} email={accountEmail} />
              </bem.AccountBox__menuItem>

              <OrganizationBadge color='light-blue' />

              {/*
                There is no UI we can show to a user who sees a router blocker, so
                we don't allow any in-app navigation.
              */}
              {!isAnyRouteBlockerActive() && (
                <bem.AccountBox__menuItem m={'settings'}>
                  <ButtonNew
                    variant='filled'
                    fullWidth
                    size='md'
                    component={Link}
                    to={ACCOUNT_ROUTES.ACCOUNT_SETTINGS}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('Account Settings')}
                  </ButtonNew>
                </bem.AccountBox__menuItem>
              )}
            </bem.AccountBox__menuLI>

            {shouldDisplayUrls && (
              <bem.AccountBox__menuLI key='2' className='environment-links'>
                {envStore.data.terms_of_service_url && (
                  <a href={envStore.data.terms_of_service_url} target='_blank'>
                    {t('Terms of Service')}
                  </a>
                )}
                {envStore.data.privacy_policy_url && (
                  <a href={envStore.data.privacy_policy_url} target='_blank'>
                    {t('Privacy Policy')}
                  </a>
                )}
              </bem.AccountBox__menuLI>
            )}

            <bem.AccountBox__menuLI m={'lang'} key='3'>
              <ButtonNew leftIcon={IconWorldFilled} variant='transparent' onClick={toggleLanguageSelector} tabIndex={0}>
                {t('Language')}
              </ButtonNew>

              {isLanguageSelectorVisible && <ul>{langs.map(renderLangItem)}</ul>}
            </bem.AccountBox__menuLI>

            <bem.AccountBox__menuLI m={'logout'} key='4'>
              <ButtonNew leftIcon={IconLogout} variant='transparent' onClick={sessionStore.logOut}>
                {t('Logout')}
              </ButtonNew>
            </bem.AccountBox__menuLI>
          </bem.AccountBox__menu>
        </Menu.Dropdown>
      </Menu>
    </bem.AccountBox>
  )
}
