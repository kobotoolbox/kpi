import React from 'react'

import { Checkbox, type SelectProps } from '@mantine/core'
import {
  type Icon,
  IconBrandInstagramFilled,
  IconBrandLinkedinFilled,
  IconBrandTwitterFilled,
} from '@tabler/icons-react'
import cx from 'classnames'
import KoboIcon from '#/components/common/KoboIcon'
import Select from '#/components/common/Select'
import TextInput from '#/components/common/TextInput'
import Textarea from '#/components/common/Textarea'
import type { ComboboxData } from '#/components/common/select.types'
import { addRequiredToLabel } from '#/textUtils'
import { recordKeys } from '#/utils'
import type { AccountFieldsConfig, AccountFieldsErrors, AccountFieldsValues, UserFieldName } from './account.constants'
import { ORGANIZATION_DEPENDENT_FIELD_NAMES } from './account.constants'
import { getUserMetadataFieldsByName, hasNoOrganizationAffiliation } from './account.utils'
import { GENDER_SELECT_OPTIONS, ORGANIZATION_TYPE_SELECT_OPTIONS } from './accountFieldOptions'
import styles from './accountFieldsEditor.module.scss'

type UserFieldValue = string | boolean

/** The fields holding text, as opposed to a checkbox. */
type TextFieldName = {
  [K in UserFieldName]-?: NonNullable<AccountFieldsValues[K]> extends string ? K : never
}[UserFieldName]

type Section = 'main' | 'bio' | 'social' | 'newsletter'

/** When both fields of a pair are shown, they start a new row together. */
const ROW_PAIRS: Partial<Record<UserFieldName, UserFieldName>> = {
  country: 'city',
  organization: 'organization_website',
}

interface AccountFieldsEditorProps {
  /**
   * What this instance asks for: which fields exist, how they are labelled, and the country and sector choices.
   * A prop rather than a store reading, so this works both with MobX and React Query.
   */
  fieldsConfig: AccountFieldsConfig
  /**
   * A list of fields to display in editor. Regardless of this list, all
   * the fields values will be returned with `onChange` callback (to avoid
   * losing data). If this is not provided, we display all fields :)
   */
  displayedFields?: UserFieldName[]
  /** Errors to be displayed for fields */
  errors?: AccountFieldsErrors
  /**
   * We need values for all fields, even if only few are displayed (via
   * `displayedFields` prop)
   */
  values: AccountFieldsValues
  onFieldChange: (fieldName: UserFieldName, value: UserFieldValue) => void
}

/**
 * A component that displays fields from user account and allows editing their
 * values. It DOES NOT handle the API calls to update the values on the endpoint.
 */
export default function AccountFieldsEditor(props: AccountFieldsEditorProps) {
  const { userMetadataFields } = props.fieldsConfig
  const metadata = getUserMetadataFieldsByName(userMetadataFields)

  /** Get label for a given user metadata fieldname */
  function getLabel(fieldName: UserFieldName): string {
    const label = metadata[fieldName]?.label
    if (!label) {
      // Here it means a field is on screen that the Backend never configured, which is worth knowing about
      console.error(`No label for fieldname "${fieldName}"`)
    }
    return label || fieldName
  }

  /** Is this field required by Backend configuration? */
  function isRequired(fieldName: UserFieldName): boolean {
    return metadata[fieldName]?.required || false
  }

  /** Get label and (required) for a given user metadata fieldname */
  function getLabelWithRequired(fieldName: UserFieldName): string {
    return addRequiredToLabel(getLabel(fieldName), isRequired(fieldName))
  }

  const cleanedUrl = (value: string) => {
    if (!value) {
      return ''
    }
    value = ('' + value).trim()
    if (!value.match(/.\../)) {
      return value
    } // "dotless". don't change it
    if (!value.match(/^https?:\/?\/?.*/)) {
      value = 'http://' + value // add missing protocol
    }
    // normalize '://' and trailing slash if URL is valid
    try {
      value = new URL(value).toString()
    } catch (e) {
      /**/
    }
    return value
  }

  function updateWebsiteAddress(input: string) {
    const cleaned = cleanedUrl(input)
    if (cleaned !== input) {
      props.onFieldChange('organization_website', cleaned)
    }
  }

  function onWebsiteKeydown(event: string) {
    if (event === 'Enter') {
      updateWebsiteAddress(props.values.organization_website || '')
    }
  }

  /**
   * Field will be displayed if it is enabled on Back end and not omitted
   * in `displayedFields`.
   *
   * NOTE: Organization-related fields are treated differently, see `isShown`.
   */
  function isFieldToBeDisplayed(name: UserFieldName) {
    return (
      // Check if field is enabled by Back-end configuration
      name in metadata &&
      // Check if parent code is not limiting displayed fields to a selection
      (!props.displayedFields ||
        // Check if parent code is limiting displayed fields to a selection, and
        // that selection includes the field
        props.displayedFields.includes(name))
    )
  }

  /**
   * 'Skip logic' for 'organization' and 'organization_website', controlled
   * by the value of 'organization_type' dropdown.
   */
  const areOrganizationFieldsToBeSkipped = hasNoOrganizationAffiliation(
    props.values,
    userMetadataFields.map((field) => field.name),
  )

  /**
   * Whether the field ends up on screen. Organization type toggles the organization fields, so it comes along
   * with either of them, regardless of `displayedFields`.
   */
  function isShown(name: UserFieldName) {
    if (name === 'organization_type') {
      return (
        name in metadata &&
        (isFieldToBeDisplayed(name) || ORGANIZATION_DEPENDENT_FIELD_NAMES.some(isFieldToBeDisplayed))
      )
    }
    if (ORGANIZATION_DEPENDENT_FIELD_NAMES.includes(name)) {
      return isFieldToBeDisplayed(name) && !areOrganizationFieldsToBeSkipped
    }
    return isFieldToBeDisplayed(name)
  }

  const textProps = (name: TextFieldName) => ({
    value: props.values[name] || '',
    onChange: (evt: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      props.onFieldChange(name, evt.currentTarget.value),
    error: props.errors?.[name],
  })

  const labelProps = (name: UserFieldName) => ({ label: getLabel(name), required: isRequired(name) })

  const select = (name: TextFieldName, data: ComboboxData<string>, extra?: Pick<SelectProps, 'searchable'>) => (
    <Select
      size='sm'
      {...labelProps(name)}
      name={name}
      clearable={!isRequired(name)}
      value={props.values[name]}
      onChange={(value) => props.onFieldChange(name, value || '')}
      onClear={() => props.onFieldChange(name, '')}
      data={data}
      error={props.errors?.[name]}
      {...extra}
    />
  )

  // The label goes in the placeholder, as the "Social" heading labels the group.
  const socialInput = (name: TextFieldName, icon: Icon) => (
    <TextInput
      size='sm'
      leftSection={<KoboIcon icon={icon} size='sm' />}
      placeholder={getLabelWithRequired(name)}
      {...textProps(name)}
    />
  )

  // Every field has to be listed, so adding one to `AccountFieldsValues` fails the build until it is handled here.
  // Display order follows key order.
  const fields: Record<UserFieldName, { section: Section; render: () => React.ReactNode } | null> = {
    name: {
      section: 'main',
      render: () => (
        <TextInput
          size='sm'
          {...labelProps('name')}
          {...textProps('name')}
          placeholder={t('Use this to display your real name to other users')}
          autoFocus
        />
      ),
    },
    gender: { section: 'main', render: () => select('gender', GENDER_SELECT_OPTIONS, { searchable: false }) },
    country: { section: 'main', render: () => select('country', props.fieldsConfig.countryChoices) },
    city: { section: 'main', render: () => <TextInput size='sm' {...labelProps('city')} {...textProps('city')} /> },
    sector: { section: 'main', render: () => select('sector', props.fieldsConfig.sectorChoices) },
    organization_type: {
      section: 'main',
      render: () => select('organization_type', ORGANIZATION_TYPE_SELECT_OPTIONS),
    },
    organization: {
      section: 'main',
      render: () => <TextInput size='sm' {...labelProps('organization')} {...textProps('organization')} />,
    },
    organization_website: {
      section: 'main',
      render: () => (
        <TextInput
          size='sm'
          type='url'
          {...labelProps('organization_website')}
          {...textProps('organization_website')}
          onBlur={(evt) => updateWebsiteAddress(evt.currentTarget.value)}
          onKeyDown={(evt) => onWebsiteKeydown(evt.key)}
        />
      ),
    },
    bio: {
      section: 'bio',
      render: () => <Textarea autosize size='sm' minRows={2} {...labelProps('bio')} {...textProps('bio')} />,
    },
    twitter: { section: 'social', render: () => socialInput('twitter', IconBrandTwitterFilled) },
    linkedin: { section: 'social', render: () => socialInput('linkedin', IconBrandLinkedinFilled) },
    instagram: { section: 'social', render: () => socialInput('instagram', IconBrandInstagramFilled) },
    newsletter_subscription: {
      section: 'newsletter',
      render: () => (
        <>
          <label className={styles.checkboxLabel}>{t('Newsletter')}</label>
          <Checkbox
            checked={props.values.newsletter_subscription || false}
            onChange={(evt) => props.onFieldChange('newsletter_subscription', evt.currentTarget.checked)}
            label={getLabel('newsletter_subscription')}
          />
        </>
      ),
    },
    // Not edited in this form
    require_auth: null,
  }

  const namesIn = (section: Section) => recordKeys(fields).filter((name) => fields[name]?.section === section)

  const renderField = (name: UserFieldName) => (
    <div key={name} className={styles.field}>
      {fields[name]?.render()}
    </div>
  )

  // Flexbox can't wrap a row early, so an empty spacer fills the odd slot before a pair. The pair check
  // ignores the "no organization" rule, so organization type keeps its half-width slot when that applies.
  const mainItems: React.ReactNode[] = []
  for (const name of namesIn('main')) {
    const pairedWith = ROW_PAIRS[name]
    if (pairedWith && mainItems.length % 2 === 1 && isFieldToBeDisplayed(name) && isFieldToBeDisplayed(pairedWith)) {
      mainItems.push(<div key={`${name}-spacer`} className={cx(styles.field, styles.spacer)} />)
    }
    if (isShown(name)) {
      mainItems.push(renderField(name))
    }
  }

  const socialNames = namesIn('social').filter(isShown)

  return (
    <div className={styles.root}>
      <div className={styles.flexFields}>{mainItems}</div>
      <div className={styles.row}>{namesIn('bio').filter(isShown).map(renderField)}</div>
      <div className={cx(styles.row, styles.rowSocial)}>
        {socialNames.length > 0 && <div className={styles.socialLabel}>{t('Social')}</div>}
        {socialNames.map(renderField)}
      </div>
      <div className={styles.row}>{namesIn('newsletter').filter(isShown).map(renderField)}</div>
    </div>
  )
}
