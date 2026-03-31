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
import { ASSET_TYPES } from '#/constants'
import envStore from '#/envStore'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { withRouter } from '#/router/legacy'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'
import { renderBackButton } from './modalHelpers'

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

    const initialFields = {
      name: '',
      organization: '',
      sector: null,
      country: null,
      tags: '',
      description: '',
    }

    if (this.props.asset && this.props.asset.settings) {
      Object.assign(initialFields, this.props.asset.settings)
    }

    this.state = {
      isSessionLoaded: !!sessionStore.isLoggedIn,
      fields: initialFields,
      isPending: false,
    }
    autoBind(this)
    if (this.props.asset) {
      this.applyPropsData()
    }
  }

  componentDidMount() {
    when(
      () => sessionStore.isInitialLoadComplete,
      () => {
        this.setState({ isSessionLoaded: true })
      },
    )
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

  applyPropsData() {
    const { asset } = this.props
    const newFields = clonedeep(this.state.fields)

    if (asset.name) {
      newFields.name = asset.name
    }
    if (asset.tag_string) {
      newFields.tags = asset.tag_string
    }

    if (asset.settings) {
      Object.assign(newFields, asset.settings)
    }

    this.setState({ fields: newFields })
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

    const { name, tags, ...settings } = this.state.fields

    const payload = {
      name: name,
      settings: JSON.stringify(settings),
      tag_string: tags,
    }

    if (this.props.asset) {
      actions.resources.updateAsset(this.props.asset.uid, payload)
    } else {
      const params = {
        ...payload,
        asset_type: this.getFormAssetType(),
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

    const currentLang = envStore.data.interface_language || 'en'
    const dynamicFields = envStore.data.extra_project_metadata_fields || []
    const SECTORS = envStore.data.sector_choices
    const COUNTRIES = envStore.data.country_choices

    return (
      <bem.FormModal__form className='project-settings'>
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

          {dynamicFields.map((field) => {
            const label = envStore.data.getLocalizedLabel(field.label, currentLang)
            const options = envStore.data.getOptionsForField(field.name)
            const value = this.state.fields[field.name]

            return (
              <bem.FormModal__item key={field.name}>
                {options.length > 0 || ['select', 'multiselect'].includes(field.type) ? (
                  <WrappedSelect
                    label={label}
                    value={value}
                    onChange={(newVal) => this.onAnyFieldChange(field.name, newVal)}
                    options={options.map((opt) => {
                      return {
                        ...opt,
                        label: envStore.data.getLocalizedLabel(opt.label, currentLang),
                      }
                    })}
                    isMulti={field.type?.includes('multi')}
                    isLimitedHeight
                    isClearable
                  />
                ) : (
                  <TextBox
                    label={label}
                    value={value || ''}
                    onChange={(newVal) => this.onAnyFieldChange(field.name, newVal)}
                    placeholder={label}
                    type={field.type === 'text-multiline' ? 'text-multiline' : undefined}
                  />
                )}
              </bem.FormModal__item>
            )
          })}

          <bem.FormModal__item>
            <KoboTagsInput
              tags={this.state.fields.tags}
              onChange={this.onAnyFieldChange.bind(this, 'tags')}
              label={t('Tags')}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          {renderBackButton(this.state.isPending)}

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
