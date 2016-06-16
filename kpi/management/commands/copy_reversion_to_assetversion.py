import sys
import json
import random

from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.forms import model_to_dict
from reversion.models import Version

from kpi.models import Asset, AssetVersion
from kpi.utils.kobo_to_xlsform import to_xlsform_structure


class Command(BaseCommand):
    def handle(self, *args, **options):
        self.create_asset_versions()
        self.build_xlsform_content()
        self.mark_deployed_versions()

    def create_asset_versions(self):
        _asset_ct = ContentType.objects.get(app_label='kpi', model='asset').id
        asset_count = Asset.objects.count()
        index = 0
        step = 100
        for index in xrange(0, asset_count - 1, step):
            max_i = index + step if ((index + step) < asset_count) else \
                        asset_count - 1
            batch = Asset.objects.all()[index:max_i].values_list('id',
                                                                 flat=True)
            v_queryset = Version.objects.filter(content_type_id=_asset_ct,
                                                object_id_int__in=batch)
            rvids = v_queryset.values_list('id', flat=True)
            av_qs = AssetVersion.objects.filter(_reversion_version_id__in=rvids)
            if index % 1000 == 0:
                print 'Batch creating AssetVersions: @ {}   [{}, {}, {}]'.format(
                                index,
                                len(batch), len(rvids), av_qs.count()
                            )
            sys.stdout.write('.')
            sys.stdout.flush()
            for asset_reversion in v_queryset.all():
                sdata = json.loads(asset_reversion.serialized_data)[0].get('fields')
                try:
                    av = av_qs.get(_reversion_version_id=asset_reversion.id)
                    av.name = sdata.get('name')
                    av.version_content = json.loads(sdata.get('content'))
                    av.date_modified = sdata.get('date_modified')
                    av.save()
                except AssetVersion.DoesNotExist, e:
                    av = AssetVersion.objects.create(name=sdata.get('name'),
                                        _reversion_version_id=asset_reversion.id,
                                        asset_id=asset_reversion.object_id,
                                        date_modified=sdata.get('date_modified'),
                                        version_content=json.loads(sdata.get('content')))

            index += step
        print '{} AssetVersions exist'.format(AssetVersion.objects.count())

    def build_xlsform_content(self):
        asset_count = AssetVersion.objects.count()
        index = 0
        step = 50
        for index in xrange(0, asset_count - 1, step):
            max_i = index + step if ((index + step) < asset_count) else asset_count - 1

            for av in AssetVersion.objects.all()[index:max_i]:
                try:
                    av.deployed_content = to_xlsform_structure(av.version_content)
                    av.save()
                except KeyboardInterrupt, e:
                    raise e
                except Exception, e:
                    msg = e.message
                    if msg.startswith("Label cannot be translated"):
                        # a row has a translated label with no name (bug)
                        pass
                    else:
                        print "Error on av={} asset={}".format(av.id, av.asset.uid)
                        print e
            if index % 1000 == 0:
                print "{} :: {} || {}".format(index, max_i, asset_count)
            sys.stdout.write('.')
            sys.stdout.flush()
        print 'Reparsed {} AssetVersion files'.format(AssetVersion.objects.count())

    def mark_deployed_versions(self):
        assets = Asset.objects.filter(_deployment_data__contains='"version":')
        asset_count = assets.count()
        index = 0
        step = 100
        _mrk = 0
        for index in xrange(0, asset_count - 1, step):
            rv_ids = []
            max_i = index + step if ((index + step) < asset_count) else \
                        asset_count - 1
            for asset in assets.all()[index:max_i]:
                for revers_model in asset._deployed_versioned_assets():
                    rv_ids.append(revers_model.id)
            _mrk += len(rv_ids)
            avs = AssetVersion.objects.filter(_reversion_version_id__in=rv_ids)
            avs.update(is_deployed=True)
            if index % 1000 == 0:
                print 'Marking deployed AssetVersions: @ {} ({})'.format(index,
                                                                         _mrk)
                _mrk = 0
            sys.stdout.write('.')
            sys.stdout.flush()
