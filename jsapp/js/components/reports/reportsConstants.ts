import type {ChartType} from 'chart.js/auto';
import type {AnyRowTypeName} from 'js/constants';

export interface ReportStyle {
  /** Asset row type name (`AnyRowTypeName`) */
  groupDataBy?: string;
  report_type?: ReportStyleName;
  report_colors?: string[];
  translationIndex?: number;
  graphWidth?: number;
}

export interface CustomReportSettings {
  crid: string;
  name: string;
  /** A list of asset content rows */
  questions: string[];
  reportStyle: ReportStyle;
  specified?: {
    [rowName: string]: ReportStyle;
  };
}

interface ReportsResponseDataValueRegular {
  responses: string[];
  frequencies: number[];
  percentages: number[];
}

interface ReportsResponseDataValueNumerical {
  median?: number | '*';
  mean?: number | '*';
  mode?: number | '*';
  stdev?: number | '*';
}

export type ReportsResponseDataValue = ReportsResponseDataValueRegular | ReportsResponseDataValueNumerical;

export type ReportsResponseDataValues = Array<
  [
    number,
    ReportsResponseDataValue,
    string | number | undefined,
  ]
>;

export interface ReportsResponseData {
  total_count: number;
  not_provided: number;
  provided: number;
  show_graph: boolean;
  /**
   * The `values` property appears in the API response when `?split_by` query
   * param is being used
   */
  values?: ReportsResponseDataValues;
  responses?: string[];
  responseLabels?: string[];
  /** Integer */
  frequencies?: number[];
  /** Number with 2 decimal points */
  percentages?: number[];
  /** It shows up sometimes as empty array, no idea what is it for. */
  percentage?: [];
  /** All four are for `integer`, `decimal`, `range` types */
  median?: number | '*';
  mean?: number | '*';
  mode?: number | '*';
  stdev?: number | '*';
}

export interface ReportsResponse {
  /** The question name */
  name: string;
  row: {
    type: AnyRowTypeName;
    // TODO: check if this is actually true, for sure `string` happens in
    // the code, but the array perhaps happens (some code suggests so indirectly)
    label?: string | Array<string | null>;
  };
  data: ReportsResponseData;
  kuid: string;
  style: ReportStyle;
}

/**
 * There is some older piece of code on Back end that doesn't follow
 * the consistent responses architecture (see `PaginatedResponse` from
 * `dataInterface` file). This one is only being used by responses endpoint.
 */
export interface ReportsPaginatedResponse {
  url: string;
  count: number;
  list: ReportsResponse[];
}

/**
 * This is the `report_styles` object from `AssetResponse`. It is being used to
 * store override styles for particular questions (rows). Most of the times it
 * would be in "empty" state.
 */
export interface AssetResponseReportStyles {
  /**
   * The default styles (i.e. not overrides). This is empty if there are no
   * overrides defined (in `specified` below).
   */
  default: ReportStyle;
  /** A map of rows and their style overrides. */
  specified: {[rowName: string]: ReportStyle};
  /** This is a map of row names to their `kuid`s stored here for some reason. */
  kuid_names: {
    [rowName: string]: string;
  };
}

/**
 * This is the `report_custom` object from `AssetResponse`.
 */
export interface AssetResponseReportCustom {
  [crid: string]: CustomReportSettings;
}

/**
 * A name of the report type as KoboToolbox understands it.
 */
export type ReportStyleName =
  | 'vertical'
  | 'horizontal'
  | 'line'
  // | 'scatter'
  // | 'bubble'
  | 'pie'
  | 'donut'
  | 'area'
  | 'polar'
  | 'radar';

/**
 * Combines together `ReportStyleName`, label (for users) and `ChartType` (from
 * Chart.js library).
 */
interface ChartStyleDefinition {
  /** This is our internal name of a report style/type. */
  value: ReportStyleName;
  /**
   * This is a user friendly version of `ReportStyleName`, we use it to display
   * all available options in the settings.
   */
  label: string;
  /**
   * This is the name of a chart that Chart.js understands. For some definitions
   * it matches our internal `ReportStyleName`. We use this name to render
   * a nice graph/chart in the UI for our users.
   */
  chartJsType: ChartType;
}

type ChartStyleDefinitions = {[P in ReportStyleName]: ChartStyleDefinition};

/**
 * A list of definitions of chart styles.
 */
export const CHART_STYLES: ChartStyleDefinitions = Object.freeze({
  vertical: {
    value: 'vertical',
    label: t('Vertical'),
    chartJsType: 'bar',
  },
  horizontal: {
    value: 'horizontal',
    label: t('Horizontal'),
    // This used to be `horizontalBar`, but it was removed from Chart.js, see:
    // https://www.chartjs.org/docs/latest/charts/bar.html#horizontal-bar-chart
    // To make it horizontal we override the settings later in the code.
    chartJsType: 'bar',
  },
  line: {
    value: 'line',
    label: t('Line'),
    chartJsType: 'line',
  },
  // TODO: the `scatter` and `bubble` types require different type of data, one
  // that the reports endpoint doesn't provide yet. We need to update the
  // Back-end code first, before uncommenting this.
  // scatter: {
  //   value: 'scatter',
  //   label: t('Scatter'),
  //   chartJsType: 'scatter',
  // },
  // bubble: {
  //   value: 'bubble',
  //   label: t('Bubble'),
  //   chartJsType: 'bubble',
  // },
  pie: {
    value: 'pie',
    label: t('Pie'),
    chartJsType: 'pie',
  },
  donut: {
    value: 'donut',
    label: t('Donut'),
    chartJsType: 'doughnut',
  },
  area: {
    value: 'area',
    label: t('Area'),
    // We use same chart type as `line` above, we override settings later on.
    chartJsType: 'line',
  },
  polar: {
    value: 'polar',
    label: t('Polar area'),
    chartJsType: 'polarArea',
  },
  radar: {
    value: 'radar',
    label: t('Radar'),
    chartJsType: 'radar',
  },
});

export interface ChartColorSet {
  label: string;
  colors: string[];
}

export const CHART_COLOR_SETS: ChartColorSet[] = [
  {
    label: 'set1',
    colors: [
      'rgba(52, 106, 200, 0.8)',
      'rgba(252, 74, 124, 0.8)',
      'rgba(250, 213, 99, 0.8)',
      'rgba(113, 230, 33, 0.8)',
      'rgba(78, 203, 255, 0.8)',
      'rgba(253, 190, 76, 0.8)',
      'rgba(77, 124, 244, 0.8)',
      'rgba(33, 231, 184, 0.8)',
    ],
  },
  {
    label: 'set2',
    colors: [
      'rgba(40, 106, 163, 0.8)',
      'rgba(69, 137, 197, 0.8)',
      'rgba(0, 123, 234, 0.8)',
      'rgba(0, 134, 255, 0.8)',
      'rgba(50, 159, 255, 0.8)',
      'rgba(100, 182, 255, 0.8)',
      'rgba(141, 200, 255, 0.8)',
      'rgba(192, 224, 255, 0.8)',
    ],
  },
  {
    label: 'set3',
    colors: [
      'rgba(39, 69, 255, 0.8)',
      'rgba(34, 122, 233, 0.8)',
      'rgba(46, 145, 243, 0.8)',
      'rgba(92, 173, 255, 0.8)',
      'rgba(148, 200, 255, 0.8)',
      'rgba(31, 174, 228, 0.8)',
      'rgba(25, 214, 209, 0.8)',
      'rgba(28, 234, 225, 0.8)',
    ],
  },
  {
    label: 'set4',
    colors: [
      'rgba(253, 35, 4, 0.8)',
      'rgba(253, 104, 97, 0.8)',
      'rgba(232, 65, 14, 0.8)',
      'rgba(253, 146, 72, 0.8)',
      'rgba(233, 139, 3, 0.8)',
      'rgba(253, 215, 114, 0.8)',
      'rgba(254, 227, 159, 0.8)',
      'rgba(253, 146, 72, 0.8)',
    ],
  },
  {
    label: 'set5',
    colors: [
      'rgba(63, 63, 63, 1)',
      'rgba(90, 90, 90, 1)',
      'rgba(107, 107, 107, 1)',
      'rgba(128, 128, 128, 1)',
      'rgba(151, 151, 151, 1)',
      'rgba(169, 169, 169, 1)',
      'rgba(196, 196, 196, 1)',
      'rgba(178, 179, 190, 1)',
    ],
  },
];

/**
 * The default report style. An minimal instance of `ReportStyle` that uses
 * values from of `CHART_STYLES` and `REPORT_COLOR_SETS`.
 */
export const DEFAULT_MINIMAL_REPORT_STYLE: ReportStyle = {
  report_type: CHART_STYLES.vertical.value,
  report_colors: CHART_COLOR_SETS[0].colors,
};
