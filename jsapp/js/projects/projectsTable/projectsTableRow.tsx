// Libraries
import React from 'react';
import {Link} from 'react-router-dom';
import cx from 'classnames';

// Partial components
import Badge from 'js/components/common/badge';
import Avatar from 'js/components/common/avatar';
import AssetName from 'js/components/common/assetName';
import AssetStatusBadge from 'js/components/common/assetStatusBadge';
import Checkbox from 'js/components/common/checkbox';

// Stores, hooks and utilities
import {formatTime} from 'js/utils';
import assetUtils, {isSelfOwned} from 'js/assetUtils';

// Constants and types
import {ROUTES} from 'js/router/routerConstants';
import {PROJECT_FIELDS} from 'js/projects/projectViews/constants';
import type {
  ProjectFieldName,
  ProjectFieldDefinition,
} from 'js/projects/projectViews/constants';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';

// Styles
import styles from './projectsTableRow.module.scss';

interface ProjectsTableRowProps {
  asset: AssetResponse | ProjectViewAsset;
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  isSelected: boolean;
  onSelectRequested: (isSelected: boolean) => void;
}

export default function ProjectsTableRow(props: ProjectsTableRowProps) {
  const toggleCheckbox = () => {
    props.onSelectRequested(!props.isSelected);
  };

  const renderColumnContent = (field: ProjectFieldDefinition) => {
    switch (field.name) {
      case 'name':
        return (
          <Link
            to={ROUTES.FORM_SUMMARY.replace(':uid', props.asset.uid)}
            data-cy="asset"
          >
            <AssetName asset={props.asset} />
          </Link>
        );
      case 'description':
        return props.asset.settings.description;
      case 'status':
        return <AssetStatusBadge deploymentStatus={props.asset.deployment_status} />;
      case 'ownerUsername':
        if (isSelfOwned(props.asset)) {
          return t('me');
        } else {
          return (
            <Avatar
              username={props.asset.owner_label}
              size='s'
              isUsernameVisible
            />
          );
        }
      case 'ownerFullName':
        return 'owner__name' in props.asset ? props.asset.owner__name : null;
      case 'ownerEmail':
        return 'owner__email' in props.asset ? props.asset.owner__email : null;
      case 'ownerOrganization':
        return 'owner__organization' in props.asset
          ? props.asset.owner__organization
          : null;
      case 'dateModified':
        return formatTime(props.asset.date_modified);
      case 'dateDeployed':
        if (
          'date_deployed' in props.asset &&
          props.asset.date_deployed
        ) {
          return formatTime(props.asset.date_deployed);
        }
        return null;
      case 'sector':
        return assetUtils.getSectorDisplayString(props.asset);
      case 'countries':
        if (Array.isArray(props.asset.settings.country)) {
          return props.asset.settings.country.map((country) => (
            <Badge
              key={country.value}
              color='light-storm'
              size='m'
              label={country.label}
            />
          ));
        } else if (typeof props.asset.settings.country === 'string') {
          <Badge color='light-storm' size='m' label={props.asset.settings.country} />;
        }
        return null;
      case 'languages':
        return assetUtils.getLanguagesDisplayString(props.asset);
      case 'submissions':
        if (props.asset.deployment__submission_count === null) {
          return null;
        }
        return (
          <Badge
            color='light-storm'
            size='m'
            label={props.asset.deployment__submission_count}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={cx(styles.row, styles.rowTypeProject)}>
      {/* First column is always visible and displays a checkbox. */}
      <div
        className={styles.cell}
        data-field='checkbox'
        onClick={toggleCheckbox} // Treat whole cell as checkbox
      >
        <Checkbox
          checked={props.isSelected}
          onChange={props.onSelectRequested}
        />
      </div>

      {Object.values(PROJECT_FIELDS).map((field: ProjectFieldDefinition) => {
        // Hide not visible fields.
        if (!props.visibleFields.includes(field.name)) {
          return null;
        }

        // All the columns that could have user content
        const isUserContent = (
          field.name === 'name' ||
          field.name === 'description' ||
          field.name === 'ownerFullName' ||
          field.name === 'ownerOrganization'
        );

        return (
          <div
            className={cx({
              [styles.cell]: true,
              [styles.cellHighlighted]: props.highlightedFields.includes(
                field.name
              ),
            })}
            onClick={() => {if (field.name !== PROJECT_FIELDS.name.name) {toggleCheckbox();}}
            }
            // This attribute is being used for styling and for ColumnResizer
            data-field={field.name}
            key={field.name}
            dir={isUserContent ? 'auto' : undefined}
          >
            {renderColumnContent(field)}
          </div>
        );
      })}
    </div>
  );
}
