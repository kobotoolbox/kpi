# coding: utf-8
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.libs.utils.common_tags import USERFORM_ID


class Command(BaseCommand):
    help = "Insert all existing parsed instances into MongoDB"

    def add_arguments(self, parser):
        parser.add_argument(
            '--batchsize',
            type=int,
            default=100,
            help="Number of records to process per query")

        parser.add_argument('-u', '--username',
                            help="Username of the form user")

        parser.add_argument('-i', '--id_string',
                            help="id string of the form")

    def handle(self, *args, **kwargs):
        ids = None
        # check for username AND id_string - if one exists so must the other
        if (kwargs.get('username') and not kwargs.get('id_string')) or (
                not kwargs.get('username') and kwargs.get('id_string')):
            raise CommandError("username and id_string must either both be "
                               "specified or neither")
        elif kwargs.get('username') and kwargs.get('id_string'):
            from kobo.apps.openrosa.apps.logger.models import XForm, Instance
            xform = XForm.objects.get(user__username=kwargs.get('username'),
                                      id_string=kwargs.get('id_string'))
            ids = [i.pk for i in Instance.objects.filter(xform=xform)]
        # num records per run
        batchsize = kwargs['batchsize']
        start = 0
        end = start + batchsize
        filter_queryset = ParsedInstance.objects.all()
        # instance ids for when we have a username and id_string
        if ids:
            filter_queryset = ParsedInstance.objects.filter(instance__in=ids)
        # total number of records
        record_count = filter_queryset.count()
        i = 0
        while start < record_count:
            print('Querying record %s to %s' % (start, end-1))
            queryset = filter_queryset.order_by('pk')[start:end]
            for pi in queryset.iterator():
                if pi.update_mongo(asynchronous=False):
                    i += 1
                else:
                    print("\033[91m[ERROR] Could not parse instance {}\033[0m".format(pi.instance.uuid))

            start = start + batchsize
            end = min(record_count, start + batchsize)
        # add indexes after writing so the writing operation above is not
        # slowed
        settings.MONGO_DB.instances.create_index(USERFORM_ID)
