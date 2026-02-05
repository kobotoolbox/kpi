import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '#/components/common/button'
import protectorHelpers from '#/protector/protectorHelpers'
import { ROUTES } from '#/router/routerConstants'
import styles from './index.module.scss'

interface Props {
  assetUid: string
  hasUnsavedWork: boolean
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function ButtonReturn({ assetUid, hasUnsavedWork }: Props) {
  const navigate = useNavigate()

  /** Goes back to Data Table route for given project. */
  const onDone = () => {
    protectorHelpers.safeExecute(hasUnsavedWork, () => {
      // TODO: Consider finding a nice way to update data table when necessary,
      // rather than always forcing a reload when closing processing view.
      navigateToDataTable()
    })
  }

  const navigateToDataTable = () => {
    const newRoute = ROUTES.FORM_TABLE.replace(':uid', assetUid)
    navigate(newRoute)
  }

  return (
    <section className={styles.column}>
      <Button type='primary' size='l' label={t('DONE')} onClick={onDone} />
    </section>
  )
}
