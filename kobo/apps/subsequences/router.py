import warnings

from .models import SubmissionSupplement

warnings.warn('Oh no, this file is going away!', DeprecationWarning)


def handle_incoming_data(*args, **kwargs):
    # TODO: remove this alias
    return SubmissionSupplement.revise_data(*args, **kwargs)


def retrieve_supplemental_data(*args, **kwargs):
    # TODO: remove this alias
    return SubmissionSupplement.retrieve_data(*args, **kwargs)
