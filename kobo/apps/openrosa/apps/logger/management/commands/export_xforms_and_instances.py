#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
import os

from django.core.management.base import BaseCommand
from django.core.serializers import serialize
from django.conf import settings

# from settings import kobo.apps.open_rosa_server_DIR
from kobo.apps.openrosa.apps.logger.models import XForm, Instance


class Command(BaseCommand):
    help = "Export ODK forms and instances to JSON."

    def handle(self, *args, **kwargs):
        fixtures_dir = os.path.join(kobo.apps.open_rosa_server_DIR, "json_xform_fixtures")
        if not os.path.exists(fixtures_dir):
            os.mkdir(fixtures_dir)

        xform_fp = os.path.join(fixtures_dir, "a-xforms.json")
        instance_fp = os.path.join(fixtures_dir, "b-instances.json")

        xfp = open(xform_fp, 'w')
        xfp.write(serialize("json", XForm.objects.all()))
        xfp.close()

        ifp = open(instance_fp, 'w')
        ifp.write(serialize("json", Instance.objects.all()))
        ifp.close()
