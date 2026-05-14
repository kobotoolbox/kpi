import React from 'react'

import clonedeep from 'lodash.clonedeep'
import { when } from 'mobx'
import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import { actions } from '#/actions'
import assetUtils from '#/assetUtils'
import bem from '#/bem'
import Button from '#/components/common/button'
import KoboTagsInput from '#/components/common/koboTagsInput'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import managedCollectionsStore from '#/components/library/managedCollectionsStore'
import ExtraProjectMetadataFields from '#/components/modalForms/extraProjectMetadataFields'
import { ASSET_TYPES } from '#/constants'
import envStore from '#/envStore'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { withRouter } from '#/router/legacy'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'
import ModalBackButton from './ModalBackButton'
import styles from './libraryAssetForm.module.scss'

/**
 * Modal for creating or updating library asset (collection or template)
 *
 * NOTE: We have multiple components with similar form:
 * - ProjectSettings
 * - AccountSettingsRoute
 * - LibraryAssetForm
 *
 * @prop {Object} asset - Modal asset.
 */
export class LibraryAssetFormComponent extends React.Component {
  constructor(props) {
    super(props)
    this.unlisteners = []

    const { asset } = props
    const fields = {
      name: asset?.name || '',
      organization: asset?.settings?.organization || '',
      country: asset?.settings?.country || null,
      sector: asset?.settings?.sector || null,
      tags: asset?.tag_string || '',
      description: asset?.settings?.description || '',
    }

    this.state = {
      isSessionLoaded: !!sessionStore.isLoggedIn,
      fields,
      extraMetadataFields: {},
      isPending: false,
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

    // Load extra metadata field values from asset settings when editing
    // or seed with null value when creating a new asset
    const extraMetadataFields = {}
    for (const field of envStore.data.extra_project_metadata_fields) {
      extraMetadataFields[field.name] = this.props.asset?.settings?.extra_metadata?.[field.name] ?? null
    }
    this.setState({ extraMetadataFields })

    this.unlisteners.push(
      actions.resources.createResource.completed.listen(this.onCreateResourceCompleted.bind(this)),
      actions.resources.createResource.failed.listen(this.onCreateResourceFailed.bind(this)),
      actions.resources.updateAsset.completed.listen(this.onUpdateAssetCompleted.bind(this)),
      actions.resources.updateAsset.failed.listen(this.onUpdateAssetFailed.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onCreateResourceCompleted(response) {
    this.setState({ isPending: false })
    notify(
      t('##type## ##name## created').replace('##type##', this.getFormAssetType()).replace('##name##', response.name),
    )
    pageState.hideModal()
    if (this.getFormAssetType() === ASSET_TYPES.collection.id) {
      this.props.router.navigate(`/library/asset/${response.uid}`)
    } else if (this.getFormAssetType() === ASSET_TYPES.template.id) {
      this.props.router.navigate(`/library/asset/${response.uid}/edit`)
    }
  }

  onCreateResourceFailed() {
    this.setState({ isPending: false })
    notify(t('Failed to create ##type##').replace('##type##', this.getFormAssetType()), 'error')
  }

  onUpdateAssetCompleted() {
    this.setState({ isPending: false })
    pageState.hideModal()
  }

  onUpdateAssetFailed() {
    this.setState({ isPending: false })
    notify(t('Failed to update ##type##').replace('##type##', this.getFormAssetType()), 'error')
  }

  onSubmit(evt) {
    evt.preventDefault()
    this.setState({ isPending: true })

    const settings = JSON.stringify({
      organization: this.state.fields.organization,
      country: this.state.fields.country,
      sector: this.state.fields.sector,
      description: this.state.fields.description,
      extra_metadata: this.state.extraMetadataFields,
    })

    if (this.props.asset) {
      actions.resources.updateAsset(this.props.asset.uid, {
        name: this.state.fields.name,
        settings: settings,
        tag_string: this.state.fields.tags,
      })
    } else {
      const params = {
        name: this.state.fields.name,
        asset_type: this.getFormAssetType(),
        settings: settings,
        tag_string: this.state.fields.tags,
      }

      if (this.isLibrarySingle() && params.asset_type !== ASSET_TYPES.collection.id) {
        const found = managedCollectionsStore.find(this.currentAssetID())
        if (found && found.asset_type === ASSET_TYPES.collection.id) {
          // when creating from within a collection page, make the new asset
          // a child of this collection
          params.parent = found.url
        }
      }

      actions.resources.createResource(params)
    }
  }

  onAnyFieldChange(fieldName, newFieldValue) {
    const fields = clonedeep(this.state.fields)
    fields[fieldName] = newFieldValue
    this.setState({ fields: fields })
  }

  onExtraFieldChange(fieldName, newFieldValue) {
    this.setState((prevState) => {
      return { extraMetadataFields: { ...prevState.extraMetadataFields, [fieldName]: newFieldValue } }
    })
  }

  onNameChange(newValue) {
    this.onAnyFieldChange('name', assetUtils.removeInvalidChars(newValue))
  }

  onDescriptionChange(newValue) {
    this.onAnyFieldChange('description', assetUtils.removeInvalidChars(newValue))
  }

  /**
   * @returns existing asset type or desired asset type
   */
  getFormAssetType() {
    return this.props.asset ? this.props.asset.asset_type : this.props.assetType
  }

  isSubmitEnabled() {
    return !this.state.isPending
  }

  getSubmitButtonLabel() {
    if (this.props.asset) {
      if (this.state.isPending) {
        return t('Saving…')
      } else {
        return t('Save')
      }
    } else if (this.state.isPending) {
      return t('Creating…')
    } else {
      return t('Create')
    }
  }

  render() {
    if (!this.state.isSessionLoaded || !envStore.isReady) {
      return <LoadingSpinner />
    }

    const SECTORS = envStore.data.sector_choices
    const COUNTRIES = envStore.data.country_choices

    return (
      <bem.FormModal__form className={`project-settings ${styles.form}`}>
        <bem.FormModal__item m='wrapper' disabled={this.state.isPending}>
          <bem.FormModal__item>
            <TextBox
              value={this.state.fields.name}
              onChange={this.onNameChange.bind(this)}
              label={t('Name')}
              placeholder={t('Enter title of ##type## here').replace('##type##', this.getFormAssetType())}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              type='text-multiline'
              value={this.state.fields.description}
              onChange={this.onDescriptionChange.bind(this)}
              label={t('Description')}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              value={this.state.fields.organization}
              onChange={this.onAnyFieldChange.bind(this, 'organization')}
              label={t('Organization')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <WrappedSelect
              label={t('Primary Sector')}
              value={this.state.fields.sector}
              onChange={this.onAnyFieldChange.bind(this, 'sector')}
              options={SECTORS}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <WrappedSelect
              label={t('Country')}
              isMulti
              value={this.state.fields.country}
              onChange={this.onAnyFieldChange.bind(this, 'country')}
              options={COUNTRIES}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>

          <ExtraProjectMetadataFields values={this.state.extraMetadataFields} onChange={this.onExtraFieldChange} />

          <bem.FormModal__item>
            <KoboTagsInput
              tags={this.state.fields.tags}
              onChange={this.onAnyFieldChange.bind(this, 'tags')}
              label={t('Tags')}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          <ModalBackButton isDisabled={this.state.isPending} />

          <Button
            type='primary'
            size='l'
            onClick={this.onSubmit.bind(this)}
            isDisabled={!this.isSubmitEnabled()}
            label={this.getSubmitButtonLabel()}
          />
        </bem.Modal__footer>
      </bem.FormModal__form>
    )
  }
}

reactMixin(LibraryAssetFormComponent.prototype, Reflux.ListenerMixin)
reactMixin(LibraryAssetFormComponent.prototype, mixins.contextRouter)

export const LibraryAssetForm = withRouter(LibraryAssetFormComponent)
