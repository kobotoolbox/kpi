import sys
import time

import boto3
from dateutil.relativedelta import relativedelta
from django.db.models import Count
from django.utils import timezone

from kobo.apps.project_views.models.assignment import User

FROM_ADDRESS = 'no-reply@kobotoolbox.org'
EMAIL_TEMPLATE_NAME = 'MyTestTemplate'
MAX_SEND_RETRIES = 3

USER_DETAIL_EMAIL_PROPERTY = f'{EMAIL_TEMPLATE_NAME}_email_sent'


def run(*args):
    # To run the script in test mode, use './manage.py runscript ocha_emails --script-args test'
    test_mode = 'test' in args
    ses = boto3.client('ses', region_name='us-east-1')

    try:
        template = ses.get_template(TemplateName=EMAIL_TEMPLATE_NAME)
        print(f'got template {EMAIL_TEMPLATE_NAME}')
    except ses.exceptions.TemplateDoesNotExistException:
        print('creating template...')
        response = ses.create_template(
            Template={
                'TemplateName': EMAIL_TEMPLATE_NAME,
                'SubjectPart': '📣 Important update about the OCHA KoboToolbox server',
                'TextPart': 'Text',
                'HtmlPart': 'HTML',
            }
        )
        if response['ResponseMetadata']['HTTPStatusCode'] != 200:
            print("couldn't create template - response below")
            print(response)
            sys.exit()

    print('building users list...')
    one_year_ago = timezone.now() - relativedelta(years=1)
    active_users = User.objects.select_related('extra_details').filter(
        last_login__gte=one_year_ago, is_active=True,
    ).exclude(
        # extra_details__data__has_key=USER_DETAIL_EMAIL_PROPERTY,
    ).exclude(
        email='',
    ).only('extra_details', 'email', 'username')

    active_user_count = active_users.aggregate(user_count=Count('id'))[
        'user_count'
    ]
    print(
        f"found {active_user_count} users active since {one_year_ago.date()} who haven't received emails"
    )

    # In test mode, don't send any emails
    if test_mode:
        return

    users_emailed_count = 0

    for user in active_users.iterator(chunk_size=500):
        for attempts in range(MAX_SEND_RETRIES):
            # response = send_email(ses, user.email)
            response = {}
            wait_time = 30 * (attempts + 1)

            match 419:  # response['ResponseMetadata']['HTTPStatusCode']:
                case 200:
                    print(f'email sent to {user.username}')
                    user.extra_details.data[USER_DETAIL_EMAIL_PROPERTY] = True
                    user.extra_details.save()
                    users_emailed_count += 1
                    break
                case 429:
                    if attempts + 1 == MAX_SEND_RETRIES:
                        quit(f'hit max retry limit for the day; {users_emailed_count} sent this run')
                    print(f'hit ses rate limit, re-sending in {wait_time} seconds')
                case default:
                    if attempts + 1 == MAX_SEND_RETRIES:
                        print(f'SES keeps erroring out; {users_emailed_count} sent this run. Last response:')
                        quit(response)
                    print(f"couldn't email {user.username}, trying again in {wait_time} seconds")

            # back off for an extra 30 seconds on each retry
            # time.sleep(wait_time)

    print(f'all users processed, {users_emailed_count} emails sent this run')


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
