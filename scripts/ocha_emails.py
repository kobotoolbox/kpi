import os
import time

import boto3
from dateutil.relativedelta import relativedelta
from django.db.models import Count
from django.utils import timezone

from kobo.apps.project_views.models.assignment import User

FROM_ADDRESS = 'no-reply@kobotoolbox.org'
EMAIL_SUBJECT = '📣 Important update about the OCHA KoboToolbox server'
EMAIL_TEMPLATE_NAME = 'MyTestTemplate'
EMAIL_HTML_FILENAME = 'ocha_transition_email.html'
EMAIL_TEXT_FILENAME = 'ocha_transition_email.txt'
MAX_SEND_ATTEMPTS = 3
RETRY_WAIT_TIME = 30  # seconds


def run(*args):
    # To run the script in test mode, use './manage.py runscript ocha_emails --script-args test'
    test_mode = 'test' in args
    ses = boto3.client('ses', region_name='us-east-1')

    directory = os.path.dirname(__file__)

    print(f'getting html content from {EMAIL_HTML_FILENAME}')
    filename = os.path.join(directory, EMAIL_HTML_FILENAME)
    try:
        with open(filename) as file:
            email_html = file.read()
    except FileNotFoundError:
        quit("couldn't find html file")

    print(f'getting text content from {EMAIL_TEXT_FILENAME}')
    filename = os.path.join(directory, EMAIL_TEXT_FILENAME)
    try:
        with open(filename) as file:
            email_text = file.read()
    except FileNotFoundError:
        quit("couldn't find text file")

    template = {
        'TemplateName': EMAIL_TEMPLATE_NAME,
        'SubjectPart': EMAIL_SUBJECT,
        'TextPart': email_text,
        'HtmlPart': email_html,
    }

    try:
        ses.get_template(TemplateName=EMAIL_TEMPLATE_NAME)
        print(f'updating template {EMAIL_TEMPLATE_NAME}')
        ses.update_template(Template=template)
    except ses.exceptions.TemplateDoesNotExistException:
        print('creating template...')
        response = ses.create_template(Template=template)
        if response['ResponseMetadata']['HTTPStatusCode'] != 200:
            print("couldn't create template - response below")
            quit(response)

    print('building users list...')
    one_year_ago = timezone.now() - relativedelta(years=1)
    user_detail_email_key = f'{EMAIL_TEMPLATE_NAME}_email_sent'
    active_users = User.objects.select_related('extra_details').only('extra_details', 'email', 'username').filter(
        last_login__gte=one_year_ago, is_active=True,
    ).exclude(
        extra_details__data__has_key=user_detail_email_key,
    ).exclude(
        email='',
    )

    active_user_count = active_users.aggregate(user_count=Count('id'))[
        'user_count'
    ]
    print(
        f"found {active_user_count} users active since {one_year_ago.date()} who haven't received emails"
    )

    users_emailed_count = 0

    for user in active_users.iterator(chunk_size=500):
        for attempts in range(MAX_SEND_ATTEMPTS):
            # In test mode, don't send any emails
            if not test_mode:
                response = send_email(ses, user.email)
                status = response['ResponseMetadata']['HTTPStatusCode']
            else:
                status = 200
            wait_time = RETRY_WAIT_TIME * (attempts + 1)

            match status:
                case 200:
                    users_emailed_count += 1
                    print(f'\r{users_emailed_count / active_user_count * 100}%', end='', flush=True)
                    user.extra_details.data[user_detail_email_key] = True
                    user.extra_details.save()
                    break
                case 429:
                    if attempts + 1 == MAX_SEND_ATTEMPTS:
                        quit(
                            f'hit max retry limit of {MAX_SEND_ATTEMPTS} attempts for the day; {users_emailed_count} sent this run')
                    print(f'hit ses rate limit, re-sending in {wait_time} seconds')
                case default:
                    if attempts + 1 == MAX_SEND_ATTEMPTS:
                        print(f'SES keeps erroring out; {users_emailed_count} sent this run. Last response:')
                        quit(response)
                    print(f"couldn't email {user.username}, trying again in {wait_time} seconds")

            # back off for an extra 30 seconds on each retry (exponential enough for SES)
            time.sleep(wait_time)

    print(f'\nall users processed, {users_emailed_count} emails sent this run')


def send_email(ses, address):
    return ses.send_templated_email(
        Source=FROM_ADDRESS,
        Destination={
            'ToAddresses': [
                address,
            ],
        },
        ReplyToAddresses=[
            'no-reply@kobotoolbox.org',
        ],
        Template=EMAIL_TEMPLATE_NAME,
        TemplateData='{}',
    )
