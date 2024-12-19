// Libraries
import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import cx from 'classnames';

// Partial components
import Icon from 'js/components/common/icon';
import KoboDropdown from 'js/components/common/koboDropdown';

// Stores and hooks
import projectViewsStore from './projectViewsStore';
import {
  useOrganizationQuery,
  OrganizationUserRole,
} from 'js/account/organization/organizationQuery';

// Constants
import {PROJECTS_ROUTES} from 'js/router/routerConstants';
import {HOME_VIEW, ORG_VIEW} from './constants';

// Styles
import styles from './viewSwitcher.module.scss';

interface ViewSwitcherProps {
  selectedViewUid: string;
}

/**
 * A component that displays a view selector or just "My projects" text. What
 * options are available depends on multiple factors: belonging to MMO
 * organization, custom views being defined and user having permission to view
 * them.
 */
function ViewSwitcher(props: ViewSwitcherProps) {
  // We track the menu visibility for the trigger icon.
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [projectViews] = useState(() => projectViewsStore);
  const orgQuery = useOrganizationQuery();
  const navigate = useNavigate();

  const onOptionClick = (viewUid: string) => {
    if (viewUid === HOME_VIEW.uid || viewUid === null) {
      navigate(PROJECTS_ROUTES.MY_PROJECTS);
    } else if (viewUid === ORG_VIEW.uid) {
      navigate(PROJECTS_ROUTES.MY_ORG_PROJECTS);
    } else {
      navigate(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', viewUid));
      // The store keeps a number of assets of each view, and that number
      // might change after changing projects, so we make sure we get fresh data
      projectViews.fetchData();
    }
  };

  const displayMyOrgOption =
    orgQuery.data?.is_mmo &&
    [OrganizationUserRole.admin, OrganizationUserRole.owner].includes(
      orgQuery.data?.request_user_role
    );

  const hasMultipleOptions =
    projectViews.views.length !== 0 || displayMyOrgOption;

  const organizationName = orgQuery.data?.name || t('Organization');

  let triggerLabel = HOME_VIEW.name;
  if (props.selectedViewUid === ORG_VIEW.uid) {
    triggerLabel = ORG_VIEW.name.replace('##organization name##', organizationName);
  } else if (props.selectedViewUid !== HOME_VIEW.uid) {
    triggerLabel = projectViews.getView(props.selectedViewUid)?.name || '-';
  }

  // We don't want to display anything before the API call is done.
  if (!projectViews.isFirstLoadComplete) {
    return null;
  }

  // If there is only one option in the switcher, there is no point in making
  // this piece of UI interactive. We display a "simple" header instead.
  if (!hasMultipleOptions) {
    return (
      <button
        className={cx(styles.trigger, styles.triggerSimple)}
        title={triggerLabel}
      >
        <label>{triggerLabel}</label>
      </button>
    );
  }

  return (
    <div
      className={cx({
        [styles.root]: true,
        [styles.isMenuVisible]: isMenuVisible,
      })}
    >
      <KoboDropdown
        name='projects_view_switcher'
        placement={'down-left'}
        hideOnMenuClick
        onMenuVisibilityChange={setIsMenuVisible}
        triggerContent={
          <button className={styles.trigger} title={triggerLabel}>
            <label>{triggerLabel}</label>
            <Icon size='xxs' name={isMenuVisible ? 'caret-up' : 'caret-down'} />
          </button>
        }
        menuContent={
          <div className={styles.menu}>
            {/* This is the "My projects" option - always there */}
            <button
              key={HOME_VIEW.uid}
              className={styles.menuOption}
              onClick={() => onOptionClick(HOME_VIEW.uid)}
            >
              {HOME_VIEW.name}
            </button>

            {/* This is the organization view option - restricted to
            MMO admins and owners */}
            {displayMyOrgOption &&
              <button
                key={ORG_VIEW.uid}
                className={styles.menuOption}
                onClick={() => onOptionClick(ORG_VIEW.uid)}
              >
                {ORG_VIEW.name.replace('##organization name##', organizationName)}
              </button>
            }

            {/* This is the list of all options for custom views. These are only
            being added if custom views are defined (at least one). */}
            {projectViews.views.map((view) => (
              <button
                key={view.uid}
                className={styles.menuOption}
                onClick={() => onOptionClick(view.uid)}
              >
                {view.name}
              </button>
            ))}
          </div>
        }
      />
    </div>
  );
}

export default observer(ViewSwitcher);
