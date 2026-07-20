import React, { useEffect, useState } from 'react'
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

/**
 * This is the ROUTES.FORM_DOWNLOADS route component. It will check whether the
 * user is logged in or not and display proper child components.
 *
 * @prop {object} asset
 */
export default function ProjectDownloads(props: ProjectDownloadsProps) {
  const [selectedExportType, setSelectedExportType] = useState<ExportTypeDefinition>(exportsStore.getExportType())

  useEffect(() => {
    const unlisten = exportsStore.listen(() => {
      setSelectedExportType(exportsStore.getExportType())
    }, null)

    return () => {
      unlisten()
    }
  }, [])

  function renderLoggedInExports() {
    if (selectedExportType.isLegacy) {
      return <LegacyExports asset={props.asset} />
    }

    return (
      <React.Fragment>
        <ProjectExportsCreator asset={props.asset} />
        <ProjectExportsList asset={props.asset} />
      </React.Fragment>
    )
  }

  const docTitle = props.asset.name || t('Untitled')

  return (
    <DocumentTitle title={`${docTitle} | KoboToolbox`}>
      <bem.FormView className='project-downloads'>
        <bem.FormView__row>
          <bem.FormView__cell m={['page-title']}>{t('Downloads')}</bem.FormView__cell>

          {sessionStore.isLoggedIn && renderLoggedInExports()}

          {!sessionStore.isLoggedIn && <AnonymousExports asset={props.asset} />}
        </bem.FormView__row>
      </bem.FormView>
    </DocumentTitle>
  )
}
