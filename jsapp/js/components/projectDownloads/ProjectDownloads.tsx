import React from 'react'
import DocumentTitle from 'react-document-title'
import bem from '#/bem'
import AnonymousExports from '#/components/projectDownloads/AnonymousExports'
import LegacyExports from '#/components/projectDownloads/LegacyExports'
import ProjectExportsCreator from '#/components/projectDownloads/ProjectExportsCreator'
import ProjectExportsList from '#/components/projectDownloads/ProjectExportsList'
import exportsStore from '#/components/projectDownloads/exportsStore'
import type { AssetResponse } from '#/dataInterface'
import sessionStore from '#/stores/session'
import type { ExportTypeDefinition } from './exportsConstants'

interface ProjectDownloadsProps {
  asset: AssetResponse
}

interface ProjectDownloadsState {
  selectedExportType: ExportTypeDefinition
}

/**
 * This is the ROUTES.FORM_DOWNLOADS route component. It will check whether the
 * user is logged in or not and display proper child components.
 *
 * @prop {object} asset
 */
export default class ProjectDownloads extends React.Component<ProjectDownloadsProps, ProjectDownloadsState> {
  constructor(props: ProjectDownloadsProps) {
    super(props)
    this.state = { selectedExportType: exportsStore.getExportType() }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(exportsStore.listen(this.onExportsStoreChange.bind(this), this))
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onExportsStoreChange() {
    this.setState({ selectedExportType: exportsStore.getExportType() })
  }

  renderLoggedInExports() {
    if (this.state.selectedExportType.isLegacy) {
      return <LegacyExports asset={this.props.asset} />
    } else {
      return (
        <React.Fragment>
          <ProjectExportsCreator asset={this.props.asset} />
          <ProjectExportsList asset={this.props.asset} />
        </React.Fragment>
      )
    }
  }

  render() {
    const docTitle = this.props.asset.name || t('Untitled')
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView className='project-downloads'>
          <bem.FormView__row>
            <bem.FormView__cell m={['page-title']}>{t('Downloads')}</bem.FormView__cell>

            {sessionStore.isLoggedIn && this.renderLoggedInExports()}

            {!sessionStore.isLoggedIn && <AnonymousExports asset={this.props.asset} />}
          </bem.FormView__row>
        </bem.FormView>
      </DocumentTitle>
    )
  }
}
