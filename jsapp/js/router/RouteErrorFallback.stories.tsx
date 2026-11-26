import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { expect } from 'storybook/test'
import RouteErrorFallback from './RouteErrorFallback'

function Crash(): never {
  throw new Error('Something broke while rendering')
}

/** A real data router, so the story goes through the same `errorElement` path as the app */
function CrashingApp() {
  const router = createMemoryRouter([{ path: '/', element: <Crash />, errorElement: <RouteErrorFallback /> }])
  return <RouterProvider router={router} />
}

/** What users see when a route throws during render */
const meta: Meta<typeof CrashingApp> = {
  title: 'Features/RouteErrorFallback',
  component: CrashingApp,
}

export default meta
type Story = StoryObj<typeof CrashingApp>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Something broke while rendering')).toBeInTheDocument()
    await expect(canvas.getByText(/Crash/)).toBeInTheDocument()
    await expect(canvas.queryByText(/Hey developer/)).not.toBeInTheDocument()
  },
}
