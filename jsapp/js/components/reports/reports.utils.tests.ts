import chai from 'chai'
import { QuestionTypeName } from '#/constants'
import assetFactory from '#/endpoints/asset.factory'
import { reportStyleFactory, reportsResponseDataFactory } from './reports.factory'
import { buildEffectiveReportStyle, getEffectiveRowReportStyle, populateSelectQuestionLabels } from './reports.utils'
import type { ReportsResponse } from './reportsConstants'

describe('buildEffectiveReportStyle', () => {
  it('keeps base colors when only report type is overridden', () => {
    const baseStyle = reportStyleFactory({
      report_type: 'vertical',
      report_colors: ['rgba(253, 35, 4, 0.8)'],
    })

    const specifiedStyle = {
      report_type: 'line' as const,
    }

    const effective = buildEffectiveReportStyle(baseStyle, specifiedStyle)

    chai.expect(effective).to.deep.equal({
      report_type: 'line',
      report_colors: ['rgba(253, 35, 4, 0.8)'],
    })
  })

  it('returns base style when specified style is empty', () => {
    const baseStyle = reportStyleFactory({
      report_type: 'vertical',
      report_colors: ['rgba(52, 106, 200, 0.8)'],
    })

    const effective = buildEffectiveReportStyle(baseStyle, {})

    chai.expect(effective).to.deep.equal(baseStyle)
  })

  it('returns specified style when there is no base style', () => {
    const specifiedStyle = {
      report_type: 'radar' as const,
    }

    const effective = buildEffectiveReportStyle(undefined, specifiedStyle)

    chai.expect(effective).to.deep.equal(specifiedStyle)
  })
})

describe('getEffectiveRowReportStyle', () => {
  it('prefers custom report overrides over default report style map', () => {
    const effective = getEffectiveRowReportStyle(
      'q1',
      {
        crid: 'custom-1',
        name: 'My report',
        questions: ['q1'],
        reportStyle: reportStyleFactory({
          report_type: 'vertical',
          report_colors: ['rgba(1, 2, 3, 0.8)'],
        }),
        specified: {
          q1: {
            report_type: 'line',
          },
        },
      },
      {
        default: reportStyleFactory({
          report_type: 'vertical',
          report_colors: ['rgba(9, 9, 9, 0.8)'],
        }),
        specified: {
          q1: {
            report_type: 'pie',
          },
        },
        kuid_names: {},
      },
    )

    chai.expect(effective).to.deep.equal({
      report_type: 'line',
      report_colors: ['rgba(1, 2, 3, 0.8)'],
    })
  })

  it('keeps inheriting updated default colors when question override only changes report type', () => {
    const specified = {
      q1: {
        report_type: 'line' as const,
      },
    }

    const firstEffective = getEffectiveRowReportStyle('q1', undefined, {
      default: reportStyleFactory({
        report_type: 'vertical',
        report_colors: ['rgba(10, 20, 30, 0.8)'],
      }),
      specified,
      kuid_names: {},
    })

    const secondEffective = getEffectiveRowReportStyle('q1', undefined, {
      default: reportStyleFactory({
        report_type: 'vertical',
        report_colors: ['rgba(40, 50, 60, 0.8)'],
      }),
      specified,
      kuid_names: {},
    })

    chai.expect(firstEffective).to.deep.equal({
      report_type: 'line',
      report_colors: ['rgba(10, 20, 30, 0.8)'],
    })
    chai.expect(secondEffective).to.deep.equal({
      report_type: 'line',
      report_colors: ['rgba(40, 50, 60, 0.8)'],
    })
  })
})

describe('populateSelectQuestionLabels', () => {
  it('fills responseLabels from translated choice labels and falls back to response name', () => {
    const row: ReportsResponse = {
      name: 'favorite_color',
      row: {
        type: QuestionTypeName.select_one,
      },
      data: reportsResponseDataFactory({
        responses: ['red', 'blue'],
      }),
      kuid: 'abc123',
      style: reportStyleFactory(),
    }

    const asset = assetFactory({
      content: {
        survey: [
          {
            $kuid: 'survey-kuid-1',
            name: 'favorite_color',
            type: QuestionTypeName.select_one,
            select_from_list_name: 'colors',
          },
        ],
        choices: [
          {
            $autovalue: '1',
            $kuid: 'choice-kuid-1',
            list_name: 'colors',
            name: 'red',
            label: ['Red', 'Rouge'],
          },
          {
            $autovalue: '2',
            $kuid: 'choice-kuid-2',
            list_name: 'colors',
            name: 'blue',
            label: ['Blue'],
          },
        ],
      },
    })

    populateSelectQuestionLabels(row, asset, 1)

    chai.expect(row.data.responseLabels).to.deep.equal(['Rouge', 'blue'])
  })
})
