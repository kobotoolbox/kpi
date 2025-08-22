from .models import SubmissionSupplement

def handle_incoming_data(*args, **kwargs):
    # TODO: remove this alias
    return SubmissionSupplement.revise_data(*args, **kwargs)

def retrieve_supplemental_data(*args, **kwargs):
    # TODO: remove this alias
    return SubmissionSupplement.retrieve_data(*args, **kwargs)