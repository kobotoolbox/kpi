import React from 'react';
import bem from 'js/bem';
import {PROJECT_FIELDS} from 'js/components/projectsView/projectsViewConstants';
import type {
  OrderDirection,
  ProjectFieldDefinition,
  ProjectFieldName,
} from 'js/components/projectsView/projectsViewConstants';
import Checkbox from 'js/components/common/checkbox';
import ProjectActionButtons from './projectActionButtons';
import AssetName from 'js/components/common/assetName';
import {formatTime} from 'js/utils';
import type {AssetResponse} from 'js/dataInterface';
import {ASSET_TYPES} from 'js/constants';
import assetUtils from 'js/assetUtils';

interface ProjectsTableRowProps {
  asset: AssetResponse;
  isSelected: boolean;
  onSelectRequested: (isSelected: boolean) => void;
}

export default function ProjectsTableRow(props: ProjectsTableRowProps) {
  const renderColumnContent = (field: ProjectFieldDefinition) => {
    switch (field.name) {
      case 'name':
        return (
          <>
            <AssetName asset={props.asset}/>

            {props.asset.settings && props.asset.tag_string && props.asset.tag_string.length > 0 &&
              <bem.AssetsTableRow__tags>
                {props.asset.tag_string.split(',').map((tag) =>
                  ([' ', <bem.AssetsTableRow__tag key={tag}>{tag}</bem.AssetsTableRow__tag>])
                )}
              </bem.AssetsTableRow__tags>
            }
          </>
        );
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
          <bem.AssetsTableRow__tag m='gray-circle'>
            {props.asset.summary.row_count}
          </bem.AssetsTableRow__tag>
        );
      default:
        return null;
    }
  };

   return (
    <bem.AssetsTableRow m={['asset', `type-${props.asset.asset_type}`]}>
      <bem.AssetsTableRow__link href={`#/library/asset/${props.asset.uid}`}/>

      <bem.AssetsTableRow__buttons>
        <ProjectActionButtons asset={props.asset}/>
      </bem.AssetsTableRow__buttons>

      {/* First column is always visible and displays a checkbox. */}
      <bem.ProjectsTableRow__column m='checkbox'>
        <Checkbox
          checked={props.isSelected}
          onChange={props.onSelectRequested}
          label=''
        />
      </bem.ProjectsTableRow__column>

      {Object.values(PROJECT_FIELDS).map((field: ProjectFieldDefinition) =>
        <bem.AssetsTableRow__column m={field.name} key={field.name}>
          {renderColumnContent(field)}
        </bem.AssetsTableRow__column>
      )}

    </bem.AssetsTableRow>
  );
}
