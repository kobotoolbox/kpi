import { CHART_COLOR_SETS, CHART_STYLES, type ReportStyle, type ReportsResponseData } from './reportsConstants'

/**
 * Builds a predictable `ReportStyle` test object.
 *
 * Use overrides to focus each test on only the fields that matter.
 */
export function reportStyleFactory(overrides: Partial<ReportStyle> = {}): ReportStyle {
  const baseStyle: ReportStyle = {
    report_type: CHART_STYLES.vertical.value,
    report_colors: [...CHART_COLOR_SETS[0].colors],
  }

  return {
    ...baseStyle,
    ...overrides,
  }
}

/**
 * Builds a minimal valid `ReportsResponseData` payload for report tests.
 */
export function reportsResponseDataFactory(overrides: Partial<ReportsResponseData> = {}): ReportsResponseData {
  const baseData: ReportsResponseData = {
    total_count: 10,
    not_provided: 0,
    provided: 10,
    show_graph: true,
    responses: ['yes', 'no'],
    frequencies: [1, 1],
    percentages: [50, 50],
  }

  return {
    ...baseData,
    ...overrides,
  }
}
