import os
import time

import boto3
from dateutil.relativedelta import relativedelta
from django.db.models.functions import Lower
from django.utils import timezone

from kobo.apps.project_views.models.assignment import User

FROM_ADDRESS = 'Tino Kreutzer <support@kobotoolbox.org>'
EMAIL_SUBJECT = '📣 Important update about the OCHA KoboToolbox server'
EMAIL_TEMPLATE_NAME = 'OCHATransitionEmail'
EMAIL_HTML_FILENAME = 'ocha_transition_email.html'
EMAIL_TEXT_FILENAME = 'ocha_transition_email.txt'
MAX_SEND_ATTEMPTS = 3
RETRY_WAIT_TIME = 30  # in seconds
# We don't want to use all of our available email sends; some need to be reserved for other uses (password resets, etc.)
# So we send emails until we've sent ( 24 hour sending capacity - RESERVE_EMAIL_COUNT ) emails
RESERVE_EMAIL_COUNT = 4000


def run(*args):
    # To run the script in test mode, use './manage.py runscript ocha_emails --script-args test'
    test_mode = 'test' in args
    ses = boto3.client('ses', region_name='us-east-1')

    remaining_sends = - 1
    quota = ses.get_send_quota()
    # if Max24HourSend == -1, we have unlimited daily sending quota
    if quota['Max24HourSend'] >= 0:
        print(
            f"{int(quota['SentLast24Hours'])} of {int(quota['Max24HourSend'])} *total* emails sent in the last 24 hours"
        )
        remaining_sends = int(
            quota['Max24HourSend']
            - quota['SentLast24Hours']
            - RESERVE_EMAIL_COUNT
        )
        if remaining_sends <= 0:
            quit(f'already over sending limit; exiting...')
        print(
            f'{remaining_sends} emails can be sent this run ({RESERVE_EMAIL_COUNT} kept in reserve)'
        )

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
    active_users = (
        User.objects.select_related('extra_details')
        .only('extra_details', 'email', 'username')
        .filter(
            last_login__gte=one_year_ago,
            is_active=True,
        )
        .exclude(
            extra_details__data__has_key=user_detail_email_key,
        )
        .exclude(
            email='',
        )
        .annotate(email_lowercase=Lower('email'))
        .distinct('email_lowercase')
    )

    active_user_count = len(active_users)
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
                    print(
                        f'\r{users_emailed_count / active_user_count * 100}%',
                        end='',
                        flush=True,
                    )
                    user.extra_details.data[user_detail_email_key] = True
                    user.extra_details.save()
                    if remaining_sends != -1 and users_emailed_count >= remaining_sends:
                        quit(
                            f'used up all email sends - {users_emailed_count} sent; try again in 24 hours.'
                        )
                    break
                case 429:
                    if attempts + 1 == MAX_SEND_ATTEMPTS:
                        quit(
                            f'hit max retry limit of {MAX_SEND_ATTEMPTS} attempts for the day; {users_emailed_count} sent this run'
                        )
                    print(
                        f'hit ses rate limit, re-sending in {wait_time} seconds'
                    )
                case default:
                    if attempts + 1 == MAX_SEND_ATTEMPTS:
                        print(
                            f'SES keeps erroring out; {users_emailed_count} sent this run. Last response:'
                        )
                        quit(response)
                    print(
                        f"couldn't email {user.username}, trying again in {wait_time} seconds"
                    )

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
        Template=EMAIL_TEMPLATE_NAME,
        TemplateData='{}',
    )
