// Libraries
import React from 'react';
import bem from 'js/bem';
import DocumentTitle from 'react-document-title';

// Partial components
import ProjectExportsCreator from 'js/components/projectDownloads/ProjectExportsCreator';
import ProjectExportsList from 'js/components/projectDownloads/ProjectExportsList';
import LegacyExports from 'js/components/projectDownloads/LegacyExports';
import AnonymousExports from 'js/components/projectDownloads/AnonymousExports';

// Stores, hooks and utilities
import sessionStore from 'js/stores/session';
import exportsStore from 'js/components/projectDownloads/exportsStore';

// Constants and types
import type {AssetResponse} from 'jsapp/js/dataInterface';
import type {ExportTypeDefinition} from './exportsConstants';

interface ProjectDownloadsProps {
  asset: AssetResponse;
}

interface ProjectDownloadsState {
  selectedExportType: ExportTypeDefinition;
}

/**
 * This is the ROUTES.FORM_DOWNLOADS route component. It will check whether the
 * user is logged in or not and display proper child components.
 *
 * @prop {object} asset
 */
export default class ProjectDownloads extends React.Component<
  ProjectDownloadsProps,
  ProjectDownloadsState
> {
  constructor(props: ProjectDownloadsProps) {
    super(props);
    this.state = {selectedExportType: exportsStore.getExportType()};
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      exportsStore.listen(this.onExportsStoreChange.bind(this), this),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onExportsStoreChange() {
    this.setState({selectedExportType: exportsStore.getExportType()});
  }

  renderLoggedInExports() {
    if (this.state.selectedExportType.isLegacy) {
      return (
        <LegacyExports asset={this.props.asset} />
      );
    } else {
      return (
        <React.Fragment>
          <ProjectExportsCreator asset={this.props.asset}/>
          <ProjectExportsList asset={this.props.asset}/>
        </React.Fragment>
      );
    }
  }

  render() {
    const docTitle = this.props.asset.name || t('Untitled');
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView className='project-downloads'>
          <bem.FormView__row>
            <bem.FormView__cell m={['page-title']}>
              {t('Downloads')}
            </bem.FormView__cell>

            {sessionStore.isLoggedIn &&
              this.renderLoggedInExports()
            }

            {!sessionStore.isLoggedIn &&
              <AnonymousExports asset={this.props.asset}/>
            }
          </bem.FormView__row>
        </bem.FormView>
      </DocumentTitle>
    );
  }
}
