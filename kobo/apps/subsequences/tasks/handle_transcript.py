from celery import shared_task

@shared_task
def handle_transcript(submission_uuid, xpath, result):
    # this is where we will store the transcript in the SubmissionExtras model
    pass
