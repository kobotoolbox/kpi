import { useState } from 'react'

import { handleApiFail } from '#/api'
import type { FailResponse } from '#/dataInterface'
import { notify } from '#/utils'
import Button from '../common/button'

/**
 * Button to be used in views that export data to email.
 * The button receives a label and an export function that should return a promise.
 * The function is called when the button is clicked and if no error occurs, a message is shown to the user.
 */
export default function ExportToEmailButton({
  exportFunction,
  label,
}: {
  exportFunction: () => Promise<unknown>
  label: string
}) {
  const [isPending, setIsPending] = useState(false)

  const handleClick = () => {
    setIsPending(true)
    exportFunction()
      .then(() => {
        notify(t("Export is being generated, you will recieve an email once it's done"))
      })
      .catch((error) => handleApiFail(error as FailResponse))
      .finally(() => {
        setIsPending(false)
      })
  }

  return (
    <>
      <Button size='m' type='primary' label={label} startIcon='download' onClick={handleClick} isPending={isPending} />
    </>
  )
}
