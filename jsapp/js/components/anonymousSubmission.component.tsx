import React from 'react'

import Icon from '#/components/common/icon'
import ToggleSwitch from '#/components/common/toggleSwitch'
import { DOCS_PATHS, getDocUrl } from '#/docsUrls'
import styles from './anonymousSubmission.module.scss'

interface AnonymousSubmissionProps {
  checked: boolean
  disabled: boolean
  onChange: (isChecked: boolean) => void
}

export default function AnonymousSubmission(props: AnonymousSubmissionProps) {
  return (
    <div className={styles.root}>
      <ToggleSwitch
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        label={t('Allow submissions to this form without a username and password')}
      />
      <a
        href={getDocUrl(DOCS_PATHS.RECOLECCION_DATOS)}
        className='right-tooltip wrapped-tooltip'
        target='_blank'
        data-tip={t(
          'Allow anonymous submissions for this project. Previously, this was an account-wide setting. Click the icon to learn more.',
        )}
      >
        <Icon size='s' name='help' color='storm' />
      </a>
    </div>
  )
}
