#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
import os

from django.core.management.base import BaseCommand, CommandError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.utils.backup_tools import create_zip_backup


class Command(BaseCommand):
    args = "outfile username [id_string]"
    help = "Create a zip backup of a form and all its submissions"

    def handle(self, *args, **options):
        try:
            output_file = args[0]
        except IndexError:
            raise CommandError("Provide the path to the zip file to backup to")
        else:
            output_file = os.path.realpath(output_file)

        try:
            username = args[1]
        except IndexError:
            raise CommandError("You must provide the username to publish the"
                               " form to.")
        # make sure user exists
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError("The user '%s' does not exist." % username)

        try:
            id_string = args[2]
        except IndexError:
            xform = None
        else:
            # make sure xform exists
            try:
                xform = XForm.objects.get(user=user, id_string=id_string)
            except XForm.DoesNotExist:
                raise CommandError("The id_string '%s' does not exist." %
                                   id_string)
        create_zip_backup(output_file, user, xform)
