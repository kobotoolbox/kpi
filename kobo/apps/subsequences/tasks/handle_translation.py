from celery import shared_task

@shared_task
def handle_translation(submission_uuid, xpath, result=None, callback=None):
    if callback is not None:
        result = callback()
    # this is where we will store the translation in the SubmissionExtras model
    with open('/tmp/translation_out.txt', 'a') as f:
        f.write(f'{submission_uuid}, {xpath}, {result}')
