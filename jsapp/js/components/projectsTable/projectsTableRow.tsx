import React from 'react';
import {PROJECT_FIELDS} from 'js/components/projectsView/projectsViewConstants';
import type {ProjectFieldDefinition} from 'js/components/projectsView/projectsViewConstants';
import Checkbox from 'js/components/common/checkbox';
import AssetName from 'js/components/common/assetName';
import {formatTime} from 'js/utils';
import type {AssetResponse} from 'js/dataInterface';
import assetUtils from 'js/assetUtils';
import styles from './projectsTableRow.module.scss';
import classNames from 'classnames';

interface ProjectsTableRowProps {
  asset: AssetResponse;
  isSelected: boolean;
  onSelectRequested: (isSelected: boolean) => void;
}

export default function ProjectsTableRow(props: ProjectsTableRowProps) {
  const renderColumnContent = (field: ProjectFieldDefinition) => {
    switch (field.name) {
      case 'name':
        return <AssetName asset={props.asset}/>;
      case 'description':
        return 'description';
      case 'status':
        return 'status';
      case 'ownerUsername':
        return assetUtils.getAssetOwnerDisplayName(props.asset.owner__username)
      case 'ownerFullName':
        return 'owner full name';
      case 'ownerEmail':
        return 'owner email';
      case 'ownerOrganisation':
        return 'owner organisation';
      case 'dateDeployed':
        return 'date deployed';
      case 'dateModified':
        return formatTime(props.asset.date_modified);
      case 'sector':
        return assetUtils.getSectorDisplayString(props.asset);
      case 'countries':
        return 'countries';
      case 'languages':
        return assetUtils.getLanguagesDisplayString(props.asset);
      case 'submissions':
        return (
          <span className={styles.badge}>
            {props.asset.summary.row_count}
          </span>
        );
      default:
        return null;
    }
  };

   return (
    <div className={classNames(
      styles.row,
      styles['row-project'],
      styles[`row-${props.asset.asset_type}`]
    )}>
      {/* This makes the whole row clickable */}
      <a className={styles['overlay-link']} href={`#/library/asset/${props.asset.uid}`}/>

      <div className={styles['buttons-wrapper']}>
        <ProjectActionButtons asset={props.asset}/>
      </div>

      {/* First column is always visible and displays a checkbox. */}
      <div className={classNames(styles.cell, styles['cell-checkbox'])}>
        <Checkbox
          checked={props.isSelected}
          onChange={props.onSelectRequested}
          label=''
        />
      </div>

      {Object.values(PROJECT_FIELDS).map((field: ProjectFieldDefinition) =>
        <div
          className={classNames(styles.cell, styles[`cell-${field.name}`])}
          key={field.name}
        >
          {renderColumnContent(field)}
        </div>
      )}
    </div>
  );
}
