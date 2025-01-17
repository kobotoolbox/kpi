import type {MantineLoaderComponent} from '@mantine/core';
import {Box, Loader} from '@mantine/core';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import {forwardRef} from 'react';

const KoboLoader: MantineLoaderComponent = forwardRef(({...others}, ref) => (
  <Box component='span' {...others} ref={ref}>
    <LoadingSpinner message={false} />
  </Box>
));

export const LoaderThemeKobo = Loader.extend({
  defaultProps: {
    loaders: {...Loader.defaultLoaders, custom: KoboLoader},
    type: 'custom',
  },
});
