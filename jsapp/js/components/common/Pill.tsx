// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper for the component
import { Pill as PillMantine } from '@mantine/core'
import type { PillProps as PillPropsMantine } from '@mantine/core'
import { forwardRef } from 'react'

export interface PillProps extends PillPropsMantine {}

const Pill = forwardRef<HTMLSpanElement, PillProps>((props, ref) => <PillMantine {...props} ref={ref} />)
Pill.displayName = 'Pill'

export default Pill
