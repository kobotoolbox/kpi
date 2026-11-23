import { Box, Group } from '@mantine/core'
import React, { useId } from 'react'
import styles from './FormSummary.module.scss'

interface SummarySectionProps {
  title: string
  /** Sits at the end of the title row. */
  titleAction?: React.ReactNode
  /** `nav` for lists of links. */
  component?: 'section' | 'nav'
  children: React.ReactNode
}

/** A titled white box on the project summary page. */
export default function SummarySection({ component = 'section', ...props }: SummarySectionProps) {
  const titleId = useId()

  return (
    <Box component={component} aria-labelledby={titleId}>
      <Group justify='space-between' wrap='nowrap' className={styles.sectionHeader}>
        <h2 id={titleId} className={styles.sectionTitle}>
          {props.title}
        </h2>
        {props.titleAction}
      </Group>
      <Box className={styles.sectionBox}>{props.children}</Box>
    </Box>
  )
}
