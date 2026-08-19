import { Group, Paper, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
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
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import { currentLang } from '#/utils'
import ButtonNew from '../common/ButtonNew'
import KoboIcon from '../common/KoboIcon'
import OrganizationBadge from './organizationBadge.component'

/**
 * UI element that display things only for logged-in user. An avatar that gives
 * access to a menu that allows language change, logging out and few other
 * things.
 *
 * Note: this displays a simplified content for user with invalidated password.
 */
export default function AccountMenu() {
  const [isLanguageSelectorToggled, setIsLanguageSelectorToggled] = useState<boolean>(false)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  // A collapsible list inside an already tapped-open menu is awkward on touch, so we keep the language list expanded
  // there and drop the toggle in favour of a plain section label.
  const isTouchDevice = useMediaQuery('(pointer: coarse)', false, { getInitialValueInEffect: false })
  const isLanguageSelectorVisible = isTouchDevice || isLanguageSelectorToggled

  const toggleLanguageSelector = () => {
    setIsLanguageSelectorToggled(!isLanguageSelectorToggled)
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

  if (!sessionStore.isLoggedIn) {
    return null
  }

  const accountName = sessionStore.currentAccount.username
  const accountEmail = 'email' in sessionStore.currentAccount ? sessionStore.currentAccount.email : ''

  const currentLanguage = currentLang()

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
              {isTouchDevice && (
                <Group gap={6}>
                  <KoboIcon icon={IconWorldFilled} />
                  <Text fw='600'>{t('Language')}</Text>
                </Group>
              )}
              {!isTouchDevice && (
                <ButtonNew
                  leftIcon={IconWorldFilled}
                  rightIcon={isLanguageSelectorVisible ? 'angle-down' : 'angle-up'}
                  variant='transparent'
                  onClick={toggleLanguageSelector}
                  tabIndex={0}
                  disabled={isTouchDevice}
                >
                  {t('Language')}
                </ButtonNew>
              )}

              {isLanguageSelectorVisible && (
                <Paper mt='xs'>
                  <Stack gap='xs' p='xs'>
                    {langs.map((lang) => (
                      <ButtonNew
                        variant={lang.value === currentLanguage ? 'light' : 'transparent'}
                        aria-disabled={lang.value === currentLanguage}
                        size='sm'
                        key={lang.value}
                        onClick={() => onLanguageChange(lang.value)}
                        justify='flex-start'
                      >
                        {lang.label}
                      </ButtonNew>
                    ))}
                  </Stack>
                </Paper>
              )}
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
