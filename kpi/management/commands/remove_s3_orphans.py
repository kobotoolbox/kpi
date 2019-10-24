#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 coding=utf-8
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import codecs
import re
import sys
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.files.storage import get_storage_class
from django.utils.translation import ugettext as _

from kpi.models.import_export_task import ExportTask


# S3 Monkey Patch
from boto import handler
from boto.resultset import ResultSet
from boto.s3.bucket import Bucket
import xml.sax
import xml.sax.saxutils


def _get_all(self, element_map, initial_query_string='',
             headers=None, **params):
    """
    The purpose of this method is to be used to monkey-patch
    `boto.s3.bucket.Bucket._get_all()`. The original doesn't handle
    correctly bad characters and crashes because of `xml.sax.parseString`
    which can't parse `body` as valid `XML`.
    """
    query_args = self._get_all_query_args(
        params,
        initial_query_string=initial_query_string
    )
    response = self.connection.make_request('GET', self.name,
                                            headers=headers,
                                            query_args=query_args)
    body = response.read()

    if response.status == 200:
        rs = ResultSet(element_map)
        h = handler.XmlHandler(rs, self)
        try:
            xml.sax.parseString(fix_bad_characters(body), h)
        except Exception as e:
            self.stdout.write("XML Parsing Error - {}".format(str(e)))
            error_filename = "/srv/logs/s3_body_error-{}.xml".format(str(int(time.time())))
            with open(error_filename, "w") as xmlfile_error:
                xmlfile_error.write("{}\n".format(str(e)))
                xmlfile_error.write(body)
            raise Exception(str(e))
        return rs
    else:
        raise self.connection.provider.storage_response_error(
            response.status, response.reason, body)


def fix_bad_characters(str_):
    """
    Replace unknown/bad characters `&...;` with `&amp;...;`.
    Except `&apos;`, `&quot;, `&lt;`, `&gt;` and `&amp;`
    Example:
        `&foo;` becomes `&amp;foo;` but `&lt;` stays `&lt;`
    """
    try:
        str_ = re.sub(r"&(?!(quot|apos|lt|gt|amp);)", "&amp;", str_)
    except Exception as e:
        # Try to force unicode
        str_ = re.sub(r"&(?!(quot|apos|lt|gt|amp);)", "&amp;", unicode(str_, "utf-8"))
        str_ = str_.encode("utf-8")
    return str_


class Command(BaseCommand):
    help = _('Removes orphan files in S3')

    def add_arguments(self, parser):
        super(Command, self).add_arguments(parser)

        parser.add_argument(
            "--dry-run",
            action='store_true',
            default=False,
            help="Do not delete files",
        )

        parser.add_argument(
            "--log-files",
            action='store_true',
            default=True,
            help="Save deleted files to a CSV",
        )

    def handle(self, *args, **kwargs):

        Bucket._get_all = _get_all

        dry_run = kwargs['dry_run']
        log_files = kwargs['log_files']

        self._s3 = get_storage_class('kpi.utils.extended_s3boto_storage.ExtendedS3BotoStorage')()
        all_files = self._s3.bucket.list()
        size_to_reclaim = 0
        orphans = 0

        now = time.time()
        csv_filepath = '/srv/logs/orphan_files-{}.csv'.format(int(now))

        if not settings.AWS_STORAGE_BUCKET_NAME:
            self.stdout.write('`AWS_STORAGE_BUCKET_NAME` is not set. '
                              'Please check your settings')
            sys.exit(1)

        self.stdout.write('Bucket name: {}'.format(settings.AWS_STORAGE_BUCKET_NAME))
        if dry_run:
            self.stdout.write('Dry run mode activated')
        if log_files:
            self.stdout.write('CSV: {}'.format(csv_filepath))

        if log_files:
            with open(csv_filepath, "w") as csv:
                csv.write("type,filename,filesize\n")

        for f in all_files:
            try:
                filename = f.name
                if filename[-1] != "/":
                    # KPI Exports
                    if re.match(r"[^\/]*\/exports\/.+", filename):
                        if not ExportTask.objects.filter(result=filename).exists():
                            filesize = f.size
                            orphans += 1
                            size_to_reclaim += filesize
                            if log_files:
                                csv = codecs.open(csv_filepath, "a", "utf-8")
                                csv.write("{},{},{}\n".format("exports", filename, filesize))
                                csv.close()
                            if not dry_run:
                                self.delete(f)

                if time.time() - now >= 5 * 60:
                    self.stdout.write("[{}] Still alive...".format(str(int(time.time()))))
                    now = time.time()

            except Exception as e:
                self.stdout.write("ERROR - {}".format(str(e)))
                sys.exit(-1)

        self.stdout.write("Orphans: {}".format(orphans))
        self.stdout.write("Size: {}".format(self.sizeof_fmt(size_to_reclaim)))

    def delete(self, file_object):
        try:
            self.stdout.write("File {} does not exist in DB".format(file_object.name).encode('utf-8'))
            self._s3.delete_all(file_object.name)
        except Exception as e:
            self.stdout.write("ERROR - Could not delete file {} - Reason {}".format(
                file_object.name,
                str(e)))

    @staticmethod
    def sizeof_fmt(num, suffix='B'):
        for unit in ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi']:
            if abs(num) < 1024.0:
                return "%3.1f%s%s" % (num, unit, suffix)
            num /= 1024.0
        return "%.1f%s%s" % (num, 'Yi', suffix)
