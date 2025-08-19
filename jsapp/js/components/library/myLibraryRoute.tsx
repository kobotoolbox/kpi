import React from 'react'

import type { DragEvent } from 'react'

import DocumentTitle from 'react-document-title'
import Dropzone from 'react-dropzone'
import type { FileWithPreview } from 'react-dropzone'
import bem from '#/bem'
import AssetsTable from '#/components/assetsTable/assetsTable'
import { AssetsTableContextName } from '#/components/assetsTable/assetsTableConstants'
import { ROOT_BREADCRUMBS } from '#/components/library/libraryConstants'
import { MODAL_TYPES } from '#/constants'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import type { OrderDirection } from '#/projects/projectViews/constants'
import { validFileTypes } from '#/utils'
import myLibraryStore from './myLibraryStore'
import type { MyLibraryStoreData } from './myLibraryStore'

export default class MyLibraryRoute extends React.Component<{}, MyLibraryStoreData> {
  private unlisteners: Function[] = []

  state = this.getFreshState()

  getFreshState(): MyLibraryStoreData {
    return {
      isFetchingData: myLibraryStore.data.isFetchingData,
      assets: myLibraryStore.data.assets,
      metadata: myLibraryStore.data.metadata,
      totalUserAssets: myLibraryStore.data.totalUserAssets,
      totalSearchAssets: myLibraryStore.data.totalSearchAssets,
      orderColumnId: myLibraryStore.data.orderColumnId,
      orderValue: myLibraryStore.data.orderValue,
      filterColumnId: myLibraryStore.data.filterColumnId,
      filterValue: myLibraryStore.data.filterValue,
      currentPage: myLibraryStore.data.currentPage,
      totalPages: myLibraryStore.data.totalPages,
    }
  }

  componentDidMount() {
    this.unlisteners.push(myLibraryStore.listen(this.myLibraryStoreChanged.bind(this), this))
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  myLibraryStoreChanged() {
    this.setState(this.getFreshState())
  }

  onAssetsTableOrderChange(columnId: string, value: OrderDirection) {
    myLibraryStore.setOrder(columnId, value)
  }

  onAssetsTableFilterChange(columnId: string | null, value: string | null) {
    myLibraryStore.setFilter(columnId, value)
  }

  onAssetsTableSwitchPage(pageNumber: number) {
    myLibraryStore.setCurrentPage(pageNumber)
  }

  /**
   * If only one file was passed, then open a modal for selecting the type.
   * Otherwise just start uploading all files.
   */
  onFileDrop(acceptedFiles: FileWithPreview[], rejectedFiles: FileWithPreview[], evt: DragEvent<HTMLDivElement>) {
    if (acceptedFiles.length === 1) {
      pageState.switchModal({
        type: MODAL_TYPES.LIBRARY_UPLOAD,
        file: acceptedFiles[0],
      })
    } else {
      // TODO comes from mixin
      mixins.droppable.dropFiles(acceptedFiles, rejectedFiles, evt)
    }
  }

  render() {
    let contextualEmptyMessage: React.ReactNode = t('Your search returned no results.')

    if (myLibraryStore.data.totalUserAssets === 0) {
      contextualEmptyMessage = (
        <div>
          {t(
            "Let's get started by creating your first library question, block, template or collection. Click the New button to create it.",
          )}
          <div className='pro-tip'>
            {t(
              'Advanced users: You can also drag and drop XLSForms here and they will be uploaded and converted to library items.',
            )}
          </div>
        </div>
      )
    }

    return (
      <DocumentTitle title={`${t('My Library')} | KoboToolbox`}>
        <Dropzone
          onDrop={this.onFileDrop.bind(this)}
          disableClick
          multiple
          className='dropzone'
          activeClassName='dropzone--active'
          accept={validFileTypes()}
        >
          <bem.Breadcrumbs m='gray-wrapper'>
            <bem.Breadcrumbs__crumb>{ROOT_BREADCRUMBS.MY_LIBRARY.label}</bem.Breadcrumbs__crumb>
          </bem.Breadcrumbs>

          <AssetsTable
            context={AssetsTableContextName.MY_LIBRARY}
            isLoading={this.state.isFetchingData}
            assets={this.state.assets}
            totalAssets={this.state.totalSearchAssets}
            metadata={this.state.metadata}
            orderColumnId={this.state.orderColumnId}
            orderValue={this.state.orderValue || null}
            onOrderChange={this.onAssetsTableOrderChange.bind(this)}
            filterColumnId={this.state.filterColumnId}
            filterValue={this.state.filterValue}
            onFilterChange={this.onAssetsTableFilterChange.bind(this)}
            currentPage={this.state.currentPage}
            totalPages={typeof this.state.totalPages === 'number' ? this.state.totalPages : undefined}
            onSwitchPage={this.onAssetsTableSwitchPage.bind(this)}
            emptyMessage={contextualEmptyMessage}
          />

          <div className='dropzone-active-overlay'>
            <i className='k-icon k-icon-upload' />
            {t('Drop files to upload')}
          </div>
        </Dropzone>
      </DocumentTitle>
    )
  }
}
