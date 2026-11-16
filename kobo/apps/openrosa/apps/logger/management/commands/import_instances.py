#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
import os

from django.core.management.base import BaseCommand, CommandError
from django.test import RequestFactory

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.import_tools import (
    import_instances_from_path,
    import_instances_from_zip,
)


class Command(BaseCommand):
    help = (
        'Import a zip file, a directory containing zip files '
        'or a directory of ODK instances'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            help='User who submits the instances, used for permission checks',
        )
        parser.add_argument(
            'path',
            help='Zip file, directory of zip files or directory of instances',
        )

    def handle(self, *args, **kwargs):
        username = kwargs['username']
        path = kwargs['path']
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError("The specified user '%s' does not exist." % username)

        # make sure path exists
        if not os.path.exists(path):
            raise CommandError("The specified path '%s' does not exist." % path)

        # `create_instance()` checks submission permissions against the
        # request user
        request = RequestFactory().post('/')
        request.user = user

        if os.path.isfile(path):
            self._import_zip(path, request)
            return

        self.stdout.write('Importing from dir %s..\n' % path)
        results = import_instances_from_path(path, request)
        self._log_import(results)

        for dir, subdirs, files in os.walk(path):
            for file in files:
                self._import_zip(os.path.join(dir, file), request)

    def _import_zip(self, filepath, request):
        if os.path.splitext(filepath)[1].lower() != '.zip':
            return

        self.stdout.write('Importing from zip at %s..\n' % filepath)
        results = import_instances_from_zip(filepath, request)
        self._log_import(results)

    def _log_import(self, results):
        total_count, success_count, errors = results
        self.stdout.write(
            'Total: %(total)d, Imported: %(imported)d, Errors: '
            '%(errors)s\n------------------------------\n'
            % {'total': total_count, 'imported': success_count, 'errors': errors}
        )
