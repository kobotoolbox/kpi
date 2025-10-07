import type { DecoratorFunction } from '@storybook/types'
import React from 'react'

/**
 * There is a problem when multiple stories are being displayed at once, and those multiple stories are calling the same
 * (mocked) API. In such case, `msw` is only applying the last defined handler to all the stories. Overriding them in
 * the context of a story doesn't do anything. To go around this limitation, we have an optional arg `storybookTestId`
 * that allows differentiating stories.
 *
 * When this arg is present, msw mock will be able to return a different response.
 */
const StorybookTestIdSessionDecorator: DecoratorFunction = (Story, context) => {
  React.useEffect(() => {
    if (context.args.storybookTestId) {
      sessionStorage.setItem('storybookTestId', context.args.storybookTestId)
    } else {
      sessionStorage.removeItem('storybookTestId')
    }
    // No cleanup needed for sessionStorage
  }, [context.args.storybookTestId])
  return <Story />
}

export default StorybookTestIdSessionDecorator
