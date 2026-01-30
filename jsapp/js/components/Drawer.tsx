import React, { lazy, Suspense } from 'react'
import { NavLink } from 'react-router-dom'
import bem from '#/bem'
import Button from '#/components/common/ButtonNew'
import LibrarySidebar from '#/components/library/librarySidebar'
import HelpBubble from '#/components/support/helpBubble'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import RequireAuth from '#/router/requireAuth'
import { PROJECTS_ROUTES, ROUTES } from '#/router/routerConstants'
import { MODAL_TYPES } from '../constants'
import SidebarFormsList from '../lists/sidebarForms'
import { routerIsActive } from '../router/legacy'
import sessionStore from '../stores/session'
import Icon from './common/icon'

const AccountSidebar = lazy(() => import('#/account/accountSidebar'))

/**
 * This components display the left side UI sidebar, namely these parts:
 * - the leftmost narrow sidebar:
 *   - "Projects" button
 *   - "Library" button
 *   - Github link button
 *   - `HelpBubble` trigger button
 * - the wider contextual sidebar, showing "new" button and one of these based on current route:
 *   - list of toggleable Deployed/Draft/Archived projects - when viewing project(s) related routes
 *   - "My Library" and "Public Collections" - when viewing library related routes
 *   - links to different routes - when viewing account routes
 */
export default function Drawer() {
  const isAccount = routerIsActive(ROUTES.ACCOUNT_ROOT)
  const isLibrary = routerIsActive(ROUTES.LIBRARY)

  function openNewFormModal(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()
    pageState.showModal({
      type: MODAL_TYPES.NEW_FORM,
    })
  }

  // no sidebar for not logged in users
  if (!sessionStore.isLoggedIn || 'email' in sessionStore.currentAccount === false) {
    return null
  }
  const username = sessionStore.currentAccount.username
  const userFullName = sessionStore.currentAccount.extra_details.name ?? ''
  const userUid = sessionStore.currentAccount.extra_details__uid

  return (
    <bem.KDrawer>
      <bem.KDrawer__primaryIcons>
        <NavLink to={PROJECTS_ROUTES.MY_PROJECTS} className='k-drawer__link' data-tip={t('Projects')}>
          <Icon name='projects' size='inherit' />
        </NavLink>

        <NavLink to={ROUTES.LIBRARY} className='k-drawer__link' data-tip={t('Library')}>
          <Icon name='library' size='inherit' />
        </NavLink>
      </bem.KDrawer__primaryIcons>

      <bem.KDrawer__sidebar>
        {isLibrary && (
          <bem.FormSidebarWrapper>
            <LibrarySidebar />
          </bem.FormSidebarWrapper>
        )}

        {isAccount && (
          <Suspense fallback={null}>
            <RequireAuth>
              <AccountSidebar />
            </RequireAuth>
          </Suspense>
        )}

        {!isLibrary && !isAccount && (
          <bem.FormSidebarWrapper>
            <Button size='lg' fullWidth disabled={!sessionStore.isLoggedIn} onClick={openNewFormModal}>
              {t('new').toUpperCase()}
            </Button>

            <SidebarFormsList />
          </bem.FormSidebarWrapper>
        )}
      </bem.KDrawer__sidebar>

      <bem.KDrawer__secondaryIcons>
        {sessionStore.isLoggedIn && <HelpBubble username={username} userFullName={userFullName} userUid={userUid} />}

        {envStore.isReady && envStore.data.source_code_url && (
          <a href={envStore.data.source_code_url} className='k-drawer__link' target='_blank' data-tip={t('Source')}>
            <Icon name='logo-github' />
          </a>
        )}
      </bem.KDrawer__secondaryIcons>
    </bem.KDrawer>
  )
}
