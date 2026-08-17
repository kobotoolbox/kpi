import React, { useState } from 'react'

import cx from 'classnames'
import { observer } from 'mobx-react-lite'
import { Link } from 'react-router-dom'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Menu from '#/components/common/Menu'
import Icon from '#/components/common/icon'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { HOME_VIEW, ORG_VIEW } from './constants'
import projectViewsStore from './projectViewsStore'
import styles from './viewSwitcher.module.scss'

interface ViewSwitcherProps {
  selectedViewUid: string
}

/**
 * A component that displays a view selector or just "My projects" text. What
 * options are available depends on multiple factors: belonging to MMO
 * organization, custom views being defined and user having permission to view
 * them.
 */
function ViewSwitcher(props: ViewSwitcherProps) {
  // We track the menu visibility for the trigger icon.
  const [isMenuVisible, setIsMenuVisible] = useState(false)
  const [projectViews] = useState(() => projectViewsStore)
  const [organization] = useOrganizationAssumed()

  const getOptionRoute = (viewUid: string) => {
    if (viewUid === HOME_VIEW.uid || viewUid === null) {
      return PROJECTS_ROUTES.MY_PROJECTS
    }
    if (viewUid === ORG_VIEW.uid) {
      return PROJECTS_ROUTES.MY_ORG_PROJECTS
    }
    return PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', viewUid)
  }

  const onCustomViewClick = (viewUid: string) => {
    if (viewUid !== props.selectedViewUid) {
      projectViews.fetchData()
    }
  }

  const displayMyOrgOption =
    organization.is_mmo &&
    (organization.request_user_role === MemberRoleEnum.admin || organization.request_user_role === MemberRoleEnum.owner)

  const hasMultipleOptions = projectViews.views.length !== 0 || displayMyOrgOption

  const organizationName = organization.name || t('Organization')

  let triggerLabel = HOME_VIEW.name
  if (props.selectedViewUid === ORG_VIEW.uid) {
    triggerLabel = ORG_VIEW.name.replace('##organization name##', organizationName)
  } else if (props.selectedViewUid !== HOME_VIEW.uid) {
    triggerLabel = projectViews.getView(props.selectedViewUid)?.name || '-'
  }

  // We don't want to display anything before the API call is done.
  if (!projectViews.isFirstLoadComplete) {
    return null
  }

  // If there is only one option in the switcher, there is no point in making
  // this piece of UI interactive. We display a "simple" header instead.
  if (!hasMultipleOptions) {
    return (
      <button type='button' className={cx(styles.trigger, styles.triggerSimple)} title={triggerLabel}>
        <span className={styles.triggerLabel}>{triggerLabel}</span>
      </button>
    )
  }

  return (
    <div
      className={cx({
        [styles.root]: true,
        [styles.isMenuVisible]: isMenuVisible,
      })}
    >
      <Menu
        closeOnItemClick
        position='bottom-start'
        offset={2}
        onOpen={() => setIsMenuVisible(true)}
        onClose={() => setIsMenuVisible(false)}
      >
        <Menu.Target>
          <button type='button' className={styles.trigger} title={triggerLabel}>
            <span className={styles.triggerLabel}>{triggerLabel}</span>
            <Icon size='xxs' name={isMenuVisible ? 'caret-up' : 'caret-down'} />
          </button>
        </Menu.Target>

        <Menu.Dropdown className={styles.menu}>
          {/* This is the "My projects" option - always there */}
          <Menu.Item key={HOME_VIEW.uid} component={Link} to={getOptionRoute(HOME_VIEW.uid)}>
            {HOME_VIEW.name}
          </Menu.Item>

          {/* This is the organization view option - restricted to
          MMO admins and owners */}
          {displayMyOrgOption && (
            <Menu.Item key={ORG_VIEW.uid} component={Link} to={getOptionRoute(ORG_VIEW.uid)}>
              {ORG_VIEW.name.replace('##organization name##', organizationName)}
            </Menu.Item>
          )}

          {/* This is the list of all options for custom views. These are only
          being added if custom views are defined (at least one). */}
          {projectViews.views.map((view) => (
            <Menu.Item
              key={view.uid}
              component={Link}
              to={getOptionRoute(view.uid)}
              onClick={() => onCustomViewClick(view.uid)}
            >
              {view.name}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  )
}

export default observer(ViewSwitcher)
