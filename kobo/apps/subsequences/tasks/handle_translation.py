from celery import shared_task

@shared_task
def handle_translation(submission_uuid, xpath, translated_string):
    # this is where we will store the translation in the SubmissionExtras model
    pass
