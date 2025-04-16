import type { MantineLoaderComponent } from '@mantine/core'
import { Box, Loader } from '@mantine/core'
import { forwardRef } from 'react'
import LoadingSpinner from '#/components/common/loadingSpinner'

const KoboLoaderRegular: MantineLoaderComponent = forwardRef(({ ...others }, ref) => (
  <Box component='span' {...others} ref={ref}>
    <LoadingSpinner message={false} />
  </Box>
))

const KoboLoaderBig: MantineLoaderComponent = forwardRef(({ ...others }, ref) => (
  <Box component='span' {...others} ref={ref}>
    <LoadingSpinner message={false} type='big' />
  </Box>
))

export const LoaderThemeKobo = Loader.extend({
  defaultProps: {
    loaders: {
      ...Loader.defaultLoaders,
      regular: KoboLoaderRegular,
      big: KoboLoaderBig,
    },
    type: 'regular',
  },
})
