import React from 'react';
import Badge from 'js/components/common/badge';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';

interface AssetStatusBadgeProps {
  asset: AssetResponse | ProjectViewAsset;
}

/**
 * Displays a small colorful badge with an icon. The badge tells whether
 * the project is draft, deployed, or archived.
 */
export default function AssetStatusBadge(props: AssetStatusBadgeProps) {
  if (props.asset.deployment_status === 'archived') {
    return (
      <Badge
        color='light-amber'
        size='s'
        icon='project-archived'
        label={t('archived')}
      />
    );
  } else if (props.asset.deployment_status === 'deployed') {
    return (
      <Badge
        color='light-blue'
        size='s'
        icon='project-deployed'
        label={t('deployed')}
      />
    );
  } else {
    return (
      <Badge
        color='light-teal'
        size='s'
        icon='project-draft'
        label={t('draft')}
      />
    );
  }
}
