#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
from django.core.management.base import BaseCommand

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.briefcase_client import BriefcaseClient


class Command(BaseCommand):
    help = "Insert all existing parsed instances into MongoDB"

    def add_arguments(self, parser):
        parser.add_argument('--url',
                            help="server url to pull forms and submissions")

        parser.add_argument('-u', '--username',
                            help="Username")

        parser.add_argument('-p', '--password',
                            help="Password")

        parser.add_argument('--to',
                            help="username in this server")

    def handle(self, *args, **kwargs):
        url = kwargs.get('url')
        username = kwargs.get('username')
        password = kwargs.get('password')
        to = kwargs.get('to')
        user = User.objects.get(username=to)
        bc = BriefcaseClient(username=username, password=password,
                             user=user, url=url)
        bc.download_xforms(include_instances=True)
