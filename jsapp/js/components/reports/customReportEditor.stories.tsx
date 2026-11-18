import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { getAssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import ModalNew from '#/components/common/ModalNew'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import CustomReportEditor from './customReportEditor.component'
import { reportStyleFactory, reportsResponseDataFactory } from './reports.factory'
import type { CustomReportSettings, ReportsResponse } from './reportsConstants'

const reportData: ReportsResponse[] = Array.from({ length: 12 }, (_, idx) => ({
  name: `question_${idx + 1}`,
  kuid: `kuid_question_${idx + 1}`,
  row: { type: QuestionTypeName.select_one, label: [`Question ${idx + 1}`] },
  data: reportsResponseDataFactory(),
  style: reportStyleFactory(),
}))

const existingReport: CustomReportSettings = {
  crid: 'storyCrid',
  name: 'Household summary',
  questions: ['question_2', 'question_5'],
  reportStyle: reportStyleFactory(),
}

// Cast Orval Asset to legacy AssetResponse (see DataTableWrapper.stories.tsx for details)
function buildAsset(reportCustom: Record<string, CustomReportSettings>) {
  return getAssetsRetrieveResponseMock({
    uid: 'storyCustomReportUid',
    report_custom: reportCustom,
  }) as unknown as AssetResponse
}

const meta: Meta<typeof CustomReportEditor> = {
  title: 'Features/CustomReportEditor',
  component: CustomReportEditor,
  args: { reportData },
  // TODO: improve our button - its text fails AA contrast
  parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } },
  render: (args) => (
    <ModalNew opened onClose={() => {}} title='Custom Report' size='lg'>
      <CustomReportEditor {...args} />
    </ModalNew>
  ),
}

export default meta

type Story = StoryObj<typeof CustomReportEditor>

export const NewReport: Story = {
  args: {
    asset: buildAsset({}),
    customReport: { ...existingReport, name: '', questions: [] },
  },
}

/** Saved report, so "Delete" is shown too. */
export const ExistingReport: Story = {
  args: {
    asset: buildAsset({ [existingReport.crid]: existingReport }),
    customReport: existingReport,
  },
}
