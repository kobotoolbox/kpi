import React from 'react'

import { Box } from '@mantine/core'
import FormViewSideTabs from '#/project/FormViewSideTabs'
import ProjectTopTabs from '#/project/projectTopTabs.component'
import styles from './ProjectLayout.module.scss'

interface ProjectLayoutProps {
  /** Hides the top tabs and the side menu, but keeps the page mounted. */
  isNavHidden?: boolean
  children: React.ReactNode
}

/** Project routes layout: top tabs, then the side menu (if any) next to the page. */
export default function ProjectLayout(props: ProjectLayoutProps) {
  return (
    <Box className={styles.root}>
      {!props.isNavHidden && <ProjectTopTabs />}
      <Box className={styles.body}>
        {!props.isNavHidden && <FormViewSideTabs />}
        <Box className={styles.page}>{props.children}</Box>
      </Box>
    </Box>
  )
}
