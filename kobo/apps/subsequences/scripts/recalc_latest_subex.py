# coding: utf-8

from pprint import pprint

from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.utils.determine_export_cols_with_values import (
    determine_export_cols_indiv
)

def run():
    ss = SubmissionExtras.objects.last()
    pprint(
        list(
            determine_export_cols_indiv(ss.content)
        )
    )
