#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
import os

from django.core.management.base import BaseCommand, CommandError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.logger.import_tools import (
    import_instances_from_zip,
    import_instances_from_path,
)


class Command(BaseCommand):
    args = 'username path'
    help = ("Import a zip file, a directory containing zip files "
            "or a directory of ODK instances")

    def _log_import(self, results):
        total_count, success_count, errors = results
        self.stdout.write(
            "Total: %(total)d, Imported: %(imported)d, Errors: "
            "%(errors)s\n------------------------------\n" % {
                'total': total_count, 'imported': success_count,
                'errors': errors})

    def handle(self, *args, **kwargs):
        if len(args) < 2:
            raise CommandError("Usage: <command> username file/path.")
        username = args[0]
        path = args[1]
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(
                "The specified user '%s' does not exist." % username)

        # make sure path exists
        if not os.path.exists(path):
            raise CommandError(
                "The specified path '%s' does not exist." % path)

        for dir, subdirs, files in os.walk(path):
            # check if the dir has an odk directory
            if "odk" in subdirs:
                # dont walk further down this dir
                subdirs.remove("odk")
                self.stdout.write("Importing from dir %s..\n" % dir)
                results = import_instances_from_path(dir, user)
                self.log_import(results)
            for file in files:
                filepath = os.path.join(path, file)
                if os.path.isfile(filepath) and \
                        os.path.splitext(filepath)[1].lower() == ".zip":
                    self.stdout.write(
                        "Importing from zip at %s..\n" % filepath)
                    results = import_instances_from_zip(filepath, user)
                    self.log_import(results)
