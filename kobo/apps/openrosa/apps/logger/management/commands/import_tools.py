#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
import glob
import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.import_tools import import_instances_from_zip
from kobo.apps.openrosa.apps.logger.models import Instance

IMAGES_DIR = os.path.join(settings.MEDIA_ROOT, "attachments")


class Command(BaseCommand):
    help = "Import ODK forms and instances."

    def handle(self, *args, **kwargs):
        if args.__len__() < 2:
            raise CommandError("path(xform instances) username")
        path = args[0]
        username = args[1]
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError("Invalid username %s" % username)
        debug = False
        if debug:
            print("[Importing XForm Instances from %(path)s]\n"
                  % {'path': path})
            im_count = len(glob.glob(os.path.join(IMAGES_DIR, '*')))
            print("Before Parse:")
            print(" --> Images:    %(nb)d" % {'nb': im_count})
            print(" --> Instances: %(nb)d"
                  % {'nb': Instance.objects.count()})
        import_instances_from_zip(path, user)
        if debug:
            im_count2 = len(glob.glob(os.path.join(IMAGES_DIR, '*')))
            print("After Parse:")
            print(" --> Images:    %(nb)d" % {'nb': im_count2})
            print(" --> Instances: %(nb)d"
                  % {'nb': Instance.objects.count()})
