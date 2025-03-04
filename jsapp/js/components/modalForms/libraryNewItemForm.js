import React from 'react'

import { when } from 'mobx'
import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import bem from '#/bem'
import LoadingSpinner from '#/components/common/loadingSpinner'
import managedCollectionsStore from '#/components/library/managedCollectionsStore'
import { ASSET_TYPES, MODAL_TYPES } from '#/constants'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'

class LibraryNewItemForm extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isSessionLoaded: !!sessionStore.isLoggedIn,
    }

    autoBind(this)
  }

  componentDidMount() {
    when(
      () => sessionStore.isInitialLoadComplete,
      () => {
        this.setState({ isSessionLoaded: true })
      },
    )
  }

  goToAssetCreator() {
    pageState.hideModal()

    let targetPath = ROUTES.NEW_LIBRARY_ITEM
    if (this.isLibrarySingle()) {
      const found = managedCollectionsStore.find(this.currentAssetID())
      if (found && found.asset_type === ASSET_TYPES.collection.id) {
        // when creating from within a collection page, make the new asset
        // a child of this collection
        targetPath = ROUTES.NEW_LIBRARY_CHILD.replace(':uid', found.uid)
      }
    }

    this.props.router.navigate(targetPath)
  }

  goToCollection() {
    pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_COLLECTION,
      previousType: MODAL_TYPES.LIBRARY_NEW_ITEM,
    })
  }

  goToTemplate() {
    pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_TEMPLATE,
      previousType: MODAL_TYPES.LIBRARY_NEW_ITEM,
    })
  }

  goToUpload() {
    pageState.switchModal({
      type: MODAL_TYPES.LIBRARY_UPLOAD,
      previousType: MODAL_TYPES.LIBRARY_NEW_ITEM,
    })
  }

  render() {
    if (!this.state.isSessionLoaded) {
      return <LoadingSpinner />
    }

    return (
      <bem.FormModal__form className='project-settings project-settings--form-source'>
        <bem.FormModal__item m='form-source-buttons'>
          <button onClick={this.goToAssetCreator}>
            <i className='k-icon k-icon-block' />
            {t('Question Block')}
          </button>

          <button onClick={this.goToTemplate}>
            <i className='k-icon k-icon-template' />
            {t('Template')}
          </button>

          <button onClick={this.goToUpload}>
            <i className='k-icon k-icon-upload' />
            {t('Upload')}
          </button>

          <button onClick={this.goToCollection}>
            <i className='k-icon k-icon-folder' />
            {t('Collection')}
          </button>
        </bem.FormModal__item>
      </bem.FormModal__form>
    )
  }
}

reactMixin(LibraryNewItemForm.prototype, Reflux.ListenerMixin)
reactMixin(LibraryNewItemForm.prototype, mixins.contextRouter)

export default withRouter(LibraryNewItemForm)
