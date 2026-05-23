// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper around Mantine Notification.
import { Notification } from '@mantine/core'

import classes from './Notification.module.css'

export const NotificationThemeKobo = Notification.extend({
  classNames: classes,
})
