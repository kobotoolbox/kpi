import React from 'react';
import autoBind from 'react-autobind';
import ui from 'js/ui';
import bem from 'js/bem';
import {t} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';

class AssetActionButtons extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      shouldHidePopover: false,
      isPopoverVisible: false
    };
    autoBind(this);
  }

  // methods for inner workings of component

  onMouseLeave() {
    console.debug('onMouseLeave');
    // force hide popover in next render cycle
    // (ui.PopoverMenu interface handles it this way)
    if (this.state.isPopoverVisible) {
      this.setState({shouldHidePopover: true});
    }
  }

  onPopoverSetVisible() {
    this.setState({isPopoverVisible: true});
  }

  // Methods for managing the asset

  showLanguagesModal() {
    console.debug('showLanguagesModal');
  }

  showSharingModal() {
    console.debug('showSharingModal');
  }

  showTagsModal() {
    console.debug('showTagsModal');
  }

  edit() {
    console.debug('edit');
  }

  replace() {
    console.debug('replace');
  }

  delete() {
    console.debug('delete');
  }

  deploy() {
    console.debug('deploy');
  }

  archive() {
    console.debug('archive');
  }

  unarchive() {
    console.debug('unarchive');
  }

  clone() {
    console.debug('clone');
  }

  cloneAsSurvey() {
    console.debug('cloneAsSurvey');
  }

  cloneAsTemplate() {
    console.debug('cloneAsTemplate');
  }

  moveToCollection() {
    console.debug('moveToCollection');
  }

  render() {
    const userCanEdit = true;
    const isDeployable = true;
    const ownedCollections = [];
    const downloads = [];

    return (
      <bem.AssetsTableRow__buttons onMouseLeave={this.onMouseLeave}>
        {userCanEdit &&
          <bem.AssetRow__actionIcon
            onClick={this.edit}
            data-tip={t('Edit')}
          >
            <i className='k-icon k-icon-edit'/>
          </bem.AssetRow__actionIcon>
        }

        {userCanEdit &&
          <bem.AssetRow__actionIcon
            onClick={this.showTagsModal}
            data-tip= {t('Tags')}
          >
            <i className='k-icon k-icon-tag'/>
          </bem.AssetRow__actionIcon>
        }

        {userCanEdit &&
          <bem.AssetRow__actionIcon
            onClick={this.showSharingModal}
            data-tip= {t('Share')}
          >
            <i className='k-icon k-icon-user-share'/>
          </bem.AssetRow__actionIcon>
        }

        <bem.AssetRow__actionIcon
          onClick={this.clone}
          data-tip={t('Clone')}
        >
          <i className='k-icon k-icon-clone'/>
        </bem.AssetRow__actionIcon>

        {this.props.asset_type && this.props.asset_type === ASSET_TYPES.template.id && userCanEdit &&
          <bem.AssetRow__actionIcon
            onClick={this.cloneAsSurvey}
            data-tip={t('Create project')}
          >
            <i className='k-icon k-icon-projects'/>
          </bem.AssetRow__actionIcon>
        }

        <ui.PopoverMenu
          triggerLabel={<i className='k-icon k-icon-more'/>}
          triggerTip={t('More Actions')}
          clearPopover={this.state.shouldHidePopover}
          popoverSetVisible={this.onPopoverSetVisible}
        >
          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && userCanEdit && isDeployable &&
            <bem.PopoverMenu__link onClick={this.deploy}>
              <i className='k-icon k-icon-deploy'/>
              {t('Deploy')}
            </bem.PopoverMenu__link>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && this.props.has_deployment && !this.props.deployment__active && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.unarchive}>
              <i className='k-icon k-icon-archived'/>
              {t('Unarchive')}
            </bem.PopoverMenu__link>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.replace}>
              <i className='k-icon k-icon-replace'/>
              {t('Replace form')}
            </bem.PopoverMenu__link>
          }

          {userCanEdit &&
            <bem.PopoverMenu__link onClick={this.showLanguagesModal}>
              <i className='k-icon k-icon-language'/>
              {t('Manage Translations')}
            </bem.PopoverMenu__link>
          }

          {downloads.map((dl) => {
            return (
              <bem.PopoverMenu__link
                href={dl.url}
                key={`dl-${dl.format}`}
              >
                <i className={`k-icon k-icon-${dl.format}-file`}/>
                {t('Download')}&nbsp;{dl.format.toString().toUpperCase()}
              </bem.PopoverMenu__link>
            );
          })}

          {this.props.asset_type && this.props.asset_type !== ASSET_TYPES.survey.id && ownedCollections.length > 0 &&
            <bem.PopoverMenu__heading>
              {t('Move to')}
            </bem.PopoverMenu__heading>
          }

          {this.props.asset_type && this.props.asset_type !== ASSET_TYPES.survey.id && ownedCollections.length > 0 &&
            <bem.PopoverMenu__moveTo>
              {ownedCollections.map((col) => {
                return (
                  <bem.PopoverMenu__item
                    onClick={this.moveToCollection.bind(this, col.value)}
                    key={col.value}
                    title={col.label}
                    m='move-coll-item'
                  >
                    <i className='k-icon k-icon-folder'/>
                    {col.label}
                  </bem.PopoverMenu__item>
                );
              })}
            </bem.PopoverMenu__moveTo>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && this.props.has_deployment && this.props.deployment__active && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.archive}>
              <i className='k-icon k-icon-archived'/>
              {t('Archive')}
            </bem.PopoverMenu__link>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.cloneAsTemplate}>
              <i className='k-icon k-icon-template'/>
              {t('Create template')}
            </bem.PopoverMenu__link>
          }

          {userCanEdit &&
            <bem.PopoverMenu__link onClick={this.delete}>
              <i className='k-icon k-icon-trash'/>
              {t('Delete')}
            </bem.PopoverMenu__link>
          }
        </ui.PopoverMenu>
      </bem.AssetsTableRow__buttons>
    );
  }
}

export default AssetActionButtons;
