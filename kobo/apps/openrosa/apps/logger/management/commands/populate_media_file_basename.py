#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
from django.core.management.base import BaseCommand
from django.db.models import Q, Func

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment


class SubstrFromPattern(Func):
    function = "SUBSTRING"
    template = "%(function)s(%(expressions)s from '%(pattern)s')"


class Command(BaseCommand):

    help = ("Updates indexed field `media_file_basename` "
            "which is empty or null")

    def add_arguments(self, parser):
        parser.add_argument(
            '--batchsize',
            type=int,
            default=1000,
            help="Number of records to process per query")

    def handle(self, *args, **kwargs):
        batchsize = kwargs.get("batchsize")
        stop = False
        offset = 0
        while stop is not True:
            limit = offset + batchsize
            attachments_ids = list(Attachment.objects.values_list("id", flat=True)
                                                     .filter(Q(media_file_basename=None) | Q(media_file_basename=""))
                                                     .order_by("id")[offset:limit])
            if attachments_ids:
                self.stdout.write("Updating attachments from #{} to #{}\n".format(
                    attachments_ids[0],
                    attachments_ids[-1]))

                Attachment.objects.filter(id__in=attachments_ids)\
                    .update(media_file_basename=SubstrFromPattern("media_file", pattern="/([^/]+)$"))

                offset += batchsize
            else:
                stop = True
