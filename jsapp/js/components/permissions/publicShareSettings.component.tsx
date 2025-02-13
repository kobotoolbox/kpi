import React from 'react';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import {actions} from 'js/actions';
import bem from 'js/bem';
import permConfig from './permConfig';
import {ANON_USERNAME_URL} from 'js/users/utils';
import {ROOT_URL} from 'js/constants';
import type {PermissionCodename} from './permConstants';
import type {PermissionResponse} from 'jsapp/js/dataInterface';
import envStore from 'js/envStore';
import AnonymousSubmission from '../anonymousSubmission.component';
import NewFeatureDialog from 'js/components/newFeatureDialog.component';

const HELP_ARTICLE_ANON_SUBMISSIONS_URL = 'managing_permissions.html';

interface PublicShareSettingsProps {
  publicPerms: PermissionResponse[];
  assetUid: string;
  deploymentActive: boolean;
  userCanShare: boolean;
}

class PublicShareSettings extends React.Component<PublicShareSettingsProps> {
  togglePerms(permCodename: PermissionCodename) {
    const permission = this.props.publicPerms.filter(
      (perm) =>
        perm.permission ===
        permConfig.getPermissionByCodename(permCodename)?.url
    )[0];
    if (permission) {
      actions.permissions.removeAssetPermission(
        this.props.assetUid,
        permission.url
      );
    } else {
      actions.permissions.assignAssetPermission(this.props.assetUid, {
        user: ANON_USERNAME_URL,
        permission: permConfig.getPermissionByCodename(permCodename)?.url,
      });
    }
  }

  render() {
    const uid = this.props.assetUid;
    const url = `${ROOT_URL}/#/forms/${uid}`;

    const anonCanViewPermUrl =
      permConfig.getPermissionByCodename('view_asset')?.url;
    const anonCanAddPermUrl =
      permConfig.getPermissionByCodename('add_submissions')?.url;
    const anonCanViewDataPermUrl =
      permConfig.getPermissionByCodename('view_submissions')?.url;

    const anonCanView = Boolean(
      this.props.publicPerms.filter(
        (perm) => perm.permission === anonCanViewPermUrl
      )[0]
    );
    const anonCanViewData = Boolean(
      this.props.publicPerms.filter(
        (perm) => perm.permission === anonCanViewDataPermUrl
      )[0]
    );
    const anonCanAddData = Boolean(
      this.props.publicPerms.filter(
        (perm) => perm.permission === anonCanAddPermUrl
      )[0]
    );

    return (
      <bem.FormModal__item m='permissions'>
        <bem.FormModal__item m='anonymous-submissions'>
          <NewFeatureDialog
            content={t(
              'You can now control whether to allow anonymous submissions for each project. Previously, this was an account-wide setting.'
            )}
            supportArticle={
              envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL
            }
            featureKey='anonymousSubmissions'
            pointerClass='anonymousSubmissionPointer'
            dialogClass='anonymousSubmissionDialog'
          >
            <AnonymousSubmission
              checked={anonCanAddData}
              disabled={!this.props.userCanShare}
              onChange={this.togglePerms.bind(this, 'add_submissions')}
            />
          </NewFeatureDialog>
        </bem.FormModal__item>

        <bem.FormModal__item m='permissions-header'>
          {t('Share publicly by link')}
        </bem.FormModal__item>

        <bem.FormModal__item>
          <Checkbox
            checked={anonCanView}
            disabled={!this.props.userCanShare}
            onChange={this.togglePerms.bind(this, 'view_asset')}
            label={t('Anyone can view this form')}
          />
        </bem.FormModal__item>

        {this.props.deploymentActive && (
          <bem.FormModal__item>
            <Checkbox
              checked={anonCanViewData}
              disabled={!this.props.userCanShare}
              onChange={this.togglePerms.bind(this, 'view_submissions')}
              label={t('Anyone can view submissions made to this form')}
            />
          </bem.FormModal__item>
        )}

        {anonCanView && (
          <TextBox
            label={t('Shareable link')}
            type='text'
            readOnly
            value={url}
          />
        )}
      </bem.FormModal__item>
    );
  }
}

export default PublicShareSettings;
