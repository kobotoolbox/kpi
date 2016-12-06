import json
import os
import sys


kpi_root_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))

with open(os.path.join(kpi_root_dir, 'webpack-stats.json')) as webpack_stats_file:
    webpack_stats = json.load(webpack_stats_file)
webpack_public_path = webpack_stats['publicPath']
webpack_kpi_prefix = webpack_public_path.split('/static/compiled/')[0]
webpack_kpi_prefix = '/' if webpack_kpi_prefix == '' else webpack_kpi_prefix

if webpack_kpi_prefix != os.environ['KPI_PREFIX']:
    print('Outdated webpack `KPI_PREFIX` value, "{}", mismatches current environment'
          ' setting, "{}".'.format(webpack_kpi_prefix, os.environ['KPI_PREFIX']))
    sys.exit(1)
