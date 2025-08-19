#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 coding=utf-8
# coding: utf-8
from django.conf import settings
from django.core.management.base import BaseCommand

from kobo.apps.openrosa.apps.logger.models.instance import Instance


class Command(BaseCommand):

    help = "Updates is_synced_with_mongo property of Instance model"

    def add_arguments(self, parser):
        parser.add_argument(
            '--batchsize',
            type=int,
            default=100,
            help="Number of records to process per query")

    def handle(self, *args, **kwargs):
        batchsize = kwargs.get("batchsize", 100)
        xform_instances = settings.MONGO_DB.instances
        stop = False
        offset = 0
        while stop is not True:
            limit = offset + batchsize
            instance_ids = Instance.objects.values_list("id", flat=True).order_by("id")[offset:limit]
            if instance_ids:
                instance_ids = [int(instance_id) for instance_id in instance_ids]
                query = {"_id": {"$in": instance_ids}}
                cursor = xform_instances.find(query, { "_id": 1 })
                mongo_ids = list(record.get("_id") for record in cursor)
                not_synced_ids = set(instance_ids).difference(mongo_ids)

                self.stdout.write("Updating instances from #{} to #{}\n".format(
                    instance_ids[0],
                    instance_ids[-1]))

                if not_synced_ids:
                    Instance.objects.filter(id__in=not_synced_ids).update(is_synced_with_mongo=False)

                if mongo_ids:
                    Instance.objects.filter(id__in=mongo_ids).update(is_synced_with_mongo=True)

                offset += batchsize
            else:
                stop = True
