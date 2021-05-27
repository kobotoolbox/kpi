export const REPORT_STYLES = Object.freeze({
  vertical: {
    value: 'vertical',
    label: t('Vertical'),
    chartJsType: 'bar',
  },
  donut: {
    value: 'donut',
    label: t('Donut'),
    chartJsType: 'pie',
  },
  area: {
    value: 'area',
    label: t('Area'),
    chartJsType: 'line',
  },
  horizontal: {
    value: 'horizontal',
    label: t('Horizontal'),
    chartJsType: 'horizontalBar',
  },
  pie: {
    value: 'pie',
    label: t('Pie'),
    chartJsType: 'pie',
  },
  line: {
    value: 'line',
    label: t('Line'),
    chartJsType: 'line',
  },
});

export const REPORT_COLOR_SETS = [
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
