import os
import time

import boto3
from dateutil.relativedelta import relativedelta
from django.contrib.auth.models import User
from django.db.models.functions import Lower
from django.utils import timezone

MAX_SEND_ATTEMPTS = 3
RETRY_WAIT_TIME = 30  # in seconds
FROM_ADDRESS = ''
EMAIL_SUBJECT = ''
EMAIL_TEMPLATE_NAME = ''

# Path to a valid .html file to use for the email
EMAIL_HTML_FILENAME = ''

# Path to a valid .txt file to use for the email text content
EMAIL_TEXT_FILENAME = ''


# We don't want to use all of our available email sends; some need to be reserved for other uses (password resets, etc.)
# So we send emails until we've sent ( 24 hour sending capacity - RESERVE_EMAIL_COUNT ) emails
RESERVE_EMAIL_COUNT = 4000

# Whether this is a marketing email or a transactional email.
# Marketing emails aren't sent to addresses that have registered spam complaints
# Transactional emails ignore spam complaints
IS_MARKETING_EMAIL = True

# Maximum number of emails to send in one use of the script
# Set to 0 to send as many emails as SES will allow
MAX_SEND_LIMIT = 0

# Only sends to users who have logged in since this date
# Needs to be a Date object
ACTIVE_SINCE = timezone.now() - relativedelta(years=1)

start_time = time.time()


def run(*args):
    # To run the script in test mode, use './manage.py runscript mass_user_emails --script-args test'
    test_mode = 'test' in args
    # Use the 'force' arg to send emails even to users that have received the email before
    force_send = 'force' in args

    aws_region_name = os.environ.get('AWS_SES_REGION_NAME') or os.environ.get(
        'AWS_S3_REGION_NAME'
    )
    ses = boto3.client('ses', region_name=aws_region_name)

    remaining_sends = MAX_SEND_LIMIT
    quota = ses.get_send_quota()
    # if Max24HourSend == -1, we have unlimited daily sending quota
    if quota['Max24HourSend'] >= 0:
        print(
            f"{int(quota['SentLast24Hours'])} of {int(quota['Max24HourSend'])} *total* emails sent in the last 24 hours"
        )
        quota_sends = int(
            quota['Max24HourSend']
            - quota['SentLast24Hours']
            - RESERVE_EMAIL_COUNT
        )
        if quota_sends <= 0:
            quit(f'already over sending limit; exiting...')
        remaining_sends = (
            remaining_sends >= 0
            and min(quota_sends, remaining_sends)
            or quota_sends
        )
        string_sends = remaining_sends >= 0 and remaining_sends or "unlimited"
        print(
            f'{string_sends} emails can be sent this run ({RESERVE_EMAIL_COUNT} kept in reserve)'
        )

    if not test_mode:
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
    user_detail_email_key = f'{EMAIL_TEMPLATE_NAME}_email_sent'
    eligible_users = get_eligible_users(user_detail_email_key, force=force_send)

    active_user_count = len(eligible_users)
    print(f"found {active_user_count} users who haven't received emails")

    if test_mode:
        quit('in test mode, exiting before sending any emails')

    users_emailed_count = 0
    configuration_set = {}
    if IS_MARKETING_EMAIL:
        configuration_set['ConfigurationSetName'] = 'marketing_emails'

    for user in eligible_users.iterator(chunk_size=500):
        for attempts in range(MAX_SEND_ATTEMPTS):
            response = send_email(
                ses, user.email, configuration=configuration_set
            )
            status = response['ResponseMetadata']['HTTPStatusCode']
            wait_time = RETRY_WAIT_TIME * (attempts + 1)

            match status:
                case 200:
                    users_emailed_count += 1
                    print(
                        f'\r{users_emailed_count / active_user_count * 100}%',
                        end='',
                        flush=True,
                    )
                    user.extra_details.private_data[
                        user_detail_email_key
                    ] = True
                    user.extra_details.save()
                    if (
                        remaining_sends != -1
                        and users_emailed_count >= remaining_sends
                    ):
                        quit_with_time_elapsed(
                            f'\nused up all email sends - {users_emailed_count} sent'
                        )
                    break
                case 429:
                    if attempts + 1 == MAX_SEND_ATTEMPTS:
                        quit(
                            f'\nhit max retry limit of {MAX_SEND_ATTEMPTS} attempts for the day; {users_emailed_count} sent this run'
                        )
                    print(
                        f'\nhit ses rate limit, re-sending in {wait_time} seconds'
                    )
                case default:
                    if attempts + 1 == MAX_SEND_ATTEMPTS:
                        print(
                            f'\nSES keeps erroring out; {users_emailed_count} sent this run. Last response:'
                        )
                        quit_with_time_elapsed(response)
                    print(
                        f"\ncouldn't email {user.username}, trying again in {wait_time} seconds"
                    )

            # back off for an extra 30 seconds on each retry (exponential enough for SES)
            time.sleep(wait_time)
    quit_with_time_elapsed(
        f'\nall users processed, {users_emailed_count} emails sent this run'
    )


def quit_with_time_elapsed(message):
    print(message)
    end_time = time.time()
    seconds = int(end_time - start_time)
    minutes = int(seconds / 60)
    seconds = seconds % 60
    quit_message = 'script exited after '
    if minutes:
        quit_message += f'{minutes} minutes and '
    quit_message += f'{seconds} seconds'
    quit(quit_message)


def get_eligible_users(user_detail_email_key, force=False):
    # Get the list of users to email
    # Modify this function to change which users receive emails

    print(f'searching for users active since {ACTIVE_SINCE.date()}')
    eligible_users = (
        User.objects.select_related('extra_details')
        .only('extra_details', 'email', 'username')
        .filter(
            last_login__gte=ACTIVE_SINCE,
            is_active=True,
        )
        .exclude(
            email='',
        )
        .exclude(
            extra_details__isnull=True,
        )
    )
    if not force:
        eligible_users = eligible_users.exclude(
            extra_details__private_data__has_key=user_detail_email_key,
        )
    return eligible_users.annotate(email_lowercase=Lower('email')).distinct(
        'email_lowercase'
    )


def send_email(ses, address, configuration={}):
    return ses.send_templated_email(
        Source=FROM_ADDRESS,
        Destination={
            'ToAddresses': [
                address,
            ],
        },
        Template=EMAIL_TEMPLATE_NAME,
        TemplateData='{}',
        **configuration,
    )
