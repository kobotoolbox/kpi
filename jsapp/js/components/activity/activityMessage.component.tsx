import { getTextContentOnly } from '#/utils'
import Avatar from '../common/avatar'
import {
  AUDIT_ACTION_TYPES,
  type ActivityLogsItem,
  BULK_PROCESSING_ACTION_IDS,
  FALLBACK_MESSAGE,
} from './activity.constants'
import styles from './activityMessage.module.scss'

/**
 * An inline message that starts with avatar and username, and then is followed
 * by short text describing what username did.
 */
export function ActivityMessage(props: { data: ActivityLogsItem }) {
  let message = AUDIT_ACTION_TYPES[props.data.action as keyof typeof AUDIT_ACTION_TYPES]?.message || FALLBACK_MESSAGE

  // Replace default bulk processing message with more precise one
  if (props.data.action === 'bulk-processing') {
    const bulkActionId = props.data.metadata.bulk_action?.action_id
    if (bulkActionId === BULK_PROCESSING_ACTION_IDS.automaticGoogleTranscription) {
      message = t('##username## bulk transcribed audio files')
    } else if (bulkActionId === BULK_PROCESSING_ACTION_IDS.automaticGoogleTranslation) {
      message = t('##username## bulk translated transcriptions')
    }
  }

  // Here we replace all possible placeholders with appropriate data. This way
  // we don't really need to know which message (out of around 30) are we
  // dealing with - if it has given placeholder, it would be replaced, if it
  // doesn't nothing will happen.
  message = message
    .replace('##username##', `<strong>${props.data.username}</strong>`)
    .replace('##action##', props.data.action)

  // For some actions we need to replace extra placeholders
  // We will only replace the placeholders if the data is present in the metadata
  // If metadata is missing we leave the ##username2## placeholder on purpose
  // so that it is clear that the data is missing
  if (props.data.metadata.username) {
    message = message.replace('##username2##', `<strong>${props.data.metadata.username}</strong>`)
  }
  if (props.data.metadata.permissions?.username) {
    message = message.replace('##username2##', `<strong>${props.data.metadata.permissions.username}</strong>`)
  }

  return (
    <div className={styles.activityMessage} title={getTextContentOnly(message)}>
      <Avatar size='s' username={props.data.username} />
      <span dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  )
}
