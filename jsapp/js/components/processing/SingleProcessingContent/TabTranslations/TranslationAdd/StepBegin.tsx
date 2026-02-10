import React from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  onNext: () => void
}

export default function Foo({ asset, onNext }: Props) {
  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>{t('This transcript does not have any translations yet')}</header>

      <Button
        type='primary'
        size='l'
        label={t('begin')}
        onClick={onNext}
        isDisabled={!userCan('change_submissions', asset)}
      />
    </div>
  )
}
