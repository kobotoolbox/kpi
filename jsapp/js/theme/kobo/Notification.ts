import { Notification } from '@mantine/core'
import classes from './Notification.module.css'

//declare module '@mantine/core' {
//  export interface MenuItemProps {
//    variant?: 'danger'
//  }
//}

export const NotificationThemeKobo = Notification.extend({
  classNames: classes,
})
