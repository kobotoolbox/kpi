import chai from 'chai'
import { QuestionTypeName } from '#/constants'
import { ReportViewItem, type ReportViewItemProps } from './reportViewItem.component'
import { reportStyleFactory, reportsResponseDataFactory } from './reports.factory'

const REPORT_COLORS = ['rgba(253, 35, 4, 0.8)', 'rgba(253, 104, 97, 0.8)', 'rgba(232, 65, 14, 0.8)']

function buildProps(
  overrides: Partial<ReportViewItemProps> = {},
  dataOverrides: Partial<ReportViewItemProps['data']> = {},
): ReportViewItemProps {
  return {
    name: 'favorite_colors',
    kuid: 'kuid123',
    label: 'Favorite colors',
    triggerQuestionSettings: () => undefined,
    row: {
      type: QuestionTypeName.select_one,
    },
    style: reportStyleFactory({
      report_type: 'vertical',
      report_colors: REPORT_COLORS,
      graphWidth: 700,
    }),
    data: reportsResponseDataFactory({
      responses: ['red', 'orange', 'yellow'],
      percentages: [25, 50, 25],
      frequencies: [1, 2, 1],
      ...dataOverrides,
    }),
    ...overrides,
  }
}

describe('ReportViewItem.buildChartOptions', () => {
  it('applies per-dataset border and point colors for line charts', () => {
    const viewItem = new ReportViewItem(
      buildProps(
        {
          style: {
            report_type: 'line',
            report_colors: REPORT_COLORS,
          },
        },
        {
          values: [
            [
              1,
              {
                responses: ['yes', 'no'],
                frequencies: [1, 1],
                percentages: [25, 75],
              },
              'Group A',
            ],
            [
              2,
              {
                responses: ['yes', 'no'],
                frequencies: [1, 1],
                percentages: [60, 40],
              },
              'Group B',
            ],
          ],
          responseLabels: ['Yes', 'No'],
          responses: undefined,
          percentages: undefined,
          frequencies: undefined,
        },
      ),
    )

    const options = viewItem.buildChartOptions()

    chai.expect(options.data.datasets[0]).to.include({
      borderColor: REPORT_COLORS[0],
      pointBackgroundColor: REPORT_COLORS[0],
      pointBorderColor: REPORT_COLORS[0],
    })
    chai.expect(options.data.datasets[1]).to.include({
      borderColor: REPORT_COLORS[1],
      pointBackgroundColor: REPORT_COLORS[1],
      pointBorderColor: REPORT_COLORS[1],
    })
  })

  it('applies the full palette to doughnut charts', () => {
    const viewItem = new ReportViewItem(
      buildProps({
        style: {
          report_type: 'donut',
          report_colors: REPORT_COLORS,
        },
      }),
    )

    const options = viewItem.buildChartOptions()
    const datasetColors = options.data.datasets[0].backgroundColor as string[]

    chai.expect(options.type).to.equal('doughnut')
    chai.expect(datasetColors.slice(0, REPORT_COLORS.length)).to.deep.equal(REPORT_COLORS)
    chai.expect(options.data.datasets[0].borderColor).to.deep.equal(datasetColors)
  })

  it('applies the full palette to polar area charts', () => {
    const viewItem = new ReportViewItem(
      buildProps({
        style: {
          report_type: 'polar',
          report_colors: REPORT_COLORS,
        },
      }),
    )

    const options = viewItem.buildChartOptions()
    const datasetColors = options.data.datasets[0].backgroundColor as string[]

    chai.expect(options.type).to.equal('polarArea')
    chai.expect(datasetColors.slice(0, REPORT_COLORS.length)).to.deep.equal(REPORT_COLORS)
    chai.expect(options.data.datasets[0].borderColor).to.deep.equal(datasetColors)
  })
})
