import Avatar from '../common/avatar';
import {type ActivityLogsItem, AUDIT_ACTION_TYPES, FALLBACK_MESSAGE} from './activity.constants';
import styles from './activityMessage.module.scss';

export function ActivityMessage(props: {data: ActivityLogsItem}) {
  let message = AUDIT_ACTION_TYPES[props.data.action]?.message || FALLBACK_MESSAGE;

  message = message
    .replace('##username##', `<strong>${props.data.username}</strong>`)
    .replace('##action##', props.data.action);
  if (props.data.metadata.second_user) {
    message = message.replace('##username2##', `<strong>${props.data.metadata.second_user}</strong>`);
  }

  return (
    <div className={styles.activityMessage}>
      <Avatar size='s' username={props.data.username} />
      <span dangerouslySetInnerHTML={{__html: message}} />
    </div>
  );
}
