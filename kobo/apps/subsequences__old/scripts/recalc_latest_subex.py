# coding: utf-8

from pprint import pprint

from kobo.apps.subsequences__old.models import SubmissionExtrasOld
from kobo.apps.subsequences__old.utils.determine_export_cols_with_values import (
    determine_export_cols_indiv
)

def run():
    ss = SubmissionExtrasOld.objects.last()
    pprint(
        list(
            determine_export_cols_indiv(ss.content)
        )
    )
