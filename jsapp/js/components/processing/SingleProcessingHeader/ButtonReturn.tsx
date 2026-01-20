import React, { useState } from 'react'
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
  const [isDoneButtonPending, setIsDoneButtonPending] = useState(false)

  /** Goes back to Data Table route for given project. */
  const onDone = () => {
    protectorHelpers.safeExecute(hasUnsavedWork, () => {
      // HACK: If there are any changes to the data, we need to ensure that
      // the latest asset is available in the Data Table, when it will rebuild
      // itself, so that all the columns are rendered. This is needed for the case
      // when user added/deleted transcript or translation (editing the text
      // value for it is already handled properly by Data Table code).

      // TODO: Add a way to check for changes in asset if needed. For now we're always forcing a data reload.

      // if (singleProcessingStore.data.isPristine) {
      navigateToDataTable()
      // } else {
      //   // Mark button as pending to let user know we wait for stuff.
      //   setIsDoneButtonPending(true)

      //   // We don't need to add these listeners prior to this moment, and we don't
      //   // need to cancel them, as regardless of outcome, we will navigate out of
      //   // current view.
      //   unlisteners.push(actions.resources.loadAsset.completed.listen(navigateToDataTable))

      //   // For failed load we still navigate to Data Table, as this is not
      //   // something that would cause a massive disruption or data loss
      //   unlisteners.push(actions.resources.loadAsset.failed.listen(navigateToDataTable))

      //   // We force load asset to overwrite the cache, so that when
      //   // `FormSubScreens` (a parent of Data Table) starts loading in a moment,
      //   // it would fetch latest asset and make Data Table use it. To avoid
      //   // race conditions we wait until it loads to leave.
      //   actions.resources.loadAsset({ id: assetUid }, true)
      // }
    })
  }

  const navigateToDataTable = () => {
    const newRoute = ROUTES.FORM_TABLE.replace(':uid', assetUid)
    navigate(newRoute)
  }

  return (
    <section className={styles.column}>
      <Button type='primary' size='l' label={t('DONE')} isPending={isDoneButtonPending} onClick={onDone} />
    </section>
  )
}
