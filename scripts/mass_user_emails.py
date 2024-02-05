from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import boto3
import constance
import os
import time

from botocore.exceptions import ClientError
from dateutil.relativedelta import relativedelta
from django.contrib.auth.models import User
from django.db.models import F, Func, Value, CharField, Q
from django.db.models.functions import Lower
from django.utils import timezone

from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES

MAX_SEND_ATTEMPTS = 3
RETRY_WAIT_TIME = 30  # in seconds
FROM_ADDRESS = ''
EMAIL_SUBJECT = ''
EMAIL_TEMPLATE_NAME = ''

# Path to a valid .html file to use for the email
EMAIL_HTML_FILENAME = ''

# Path to a valid .txt file to use for the email text content
EMAIL_TEXT_FILENAME = ''

"""
We don't want to use all of our available email sends; some need to be reserved for other uses (password resets, etc.)
So we send emails until we've sent ( 24 hour sending capacity - RESERVE_EMAIL_COUNT ) emails
"""
RESERVE_EMAIL_COUNT = 1000

"""
Whether this is a marketing email or a transactional email.
Marketing emails aren't sent to addresses that have registered spam complaints
Transactional emails ignore spam complaints
"""
IS_MARKETING_EMAIL = True

"""
Maximum number of emails to send in one use of the script
Set to 0 to send as many emails as SES will allow
"""
MAX_SEND_LIMIT = 0

"""
Only sends to users who have logged in since this date
Needs to be a Date object
"""
ACTIVE_SINCE = timezone.now() - relativedelta(months=6)

"""
A dict containing additional queries on the User.
Only users that match all of these queries will receive emails.
Example:
[
    Q(organizations_organization__djstripe_customers__subscriptions=None) | Q(id=1),
]
"""
USER_FILTERS = [
    Q(date_joined__lte=constance.config.FREE_TIER_CUTOFF_DATE) &
    Q(
        organizations_organization__isnull=True,
    ) |
    Q(
        organizations_organization__owner__organization_user_id=F('organizations_organizationuser__id'),
    ),
]


"""
An array of dicts containing additional queries on the User.
Users matching any one of these queries won't receive emails.
Example:
[
    {
        'country': 'example',
        'email__endswith': 'example.com',
    },
    {
        'id': 5
    },
]
"""
USER_EXCLUDE = [
    {
        'organizations_organization__djstripe_customers__subscriptions__status__in': ACTIVE_STRIPE_STATUSES,
    },
]

"""
Key-value pairs to be substituted in the email
Example:
{
    'username': 'username',
    'email': 'email_cleaned',
}
"""
PERSONALIZED_FIELDS = {'username': 'username'}

CONTACT_LIST = IS_MARKETING_EMAIL and 'marketing' or 'all'

start_time = time.time()

aws_region_name = os.environ.get('AWS_SES_REGION_NAME') or os.environ.get(
    'AWS_S3_REGION_NAME'
)
ses = boto3.client('sesv2', region_name=aws_region_name)


def run(*args):
    # To run the script in test mode, use './manage.py runscript mass_user_emails --script-args test'
    test_mode = 'test' in args
    # Use the 'force' arg to send emails even to users that have received the email before
    force_send = 'force' in args

    account = ses.get_account()
    can_send = account.get('SendingEnabled')
    print(f'sending {"" if can_send else "not "}enabled in region {aws_region_name}')
    if not can_send and not test_mode:
        quit()

    remaining_sends = MAX_SEND_LIMIT
    quota = account.get('SendQuota')

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
        if quota_sends <= 0 and not test_mode:
            quit(f'already over sending limit; exiting...')
        remaining_sends = (
            remaining_sends >= 0
            and min(quota_sends, remaining_sends)
            or quota_sends
        )
        print(
            f'{remaining_sends} emails can be sent this run ({RESERVE_EMAIL_COUNT} kept in reserve)'
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
            'Subject': EMAIL_SUBJECT,
            'Text': email_text,
            'Html': email_html,
        }

    # if we're sending a marketing email, get/create a contact list for users to unsubscribe from
    if IS_MARKETING_EMAIL:
        try:
            ses.get_contact_list(ContactListName='marketing')
        except:
            ses.create_contact_list(ContactListName='marketing')

    print('building users list...')
    user_detail_email_key = f'{EMAIL_TEMPLATE_NAME}_email_sent'
    eligible_users = get_eligible_users(user_detail_email_key, force=force_send)

    active_user_count = eligible_users.count()
    if force_send:
        print(f'found {active_user_count} users')
    else:
        print(f'found {active_user_count} users who haven\'t received emails')

    if test_mode:
        quit('in test mode, exiting before sending any emails')

    users_emailed_count = 0
    configuration_set = {}
    if IS_MARKETING_EMAIL:
        configuration_set['ConfigurationSetName'] = 'marketing_emails'

    for user in eligible_users.iterator(chunk_size=500):
        if force_send:
            resubscribe_user(user.email_cleaned)
        for attempts in range(MAX_SEND_ATTEMPTS):
            try:
                response = send_email(
                    user,
                    configuration=configuration_set,
                    template=template,
                )
                status = response['ResponseMetadata']['HTTPStatusCode']
            except ClientError as e:
                print('error sending mail:')
                print(e)
                response = 'see above error'
                status = None
            wait_time = RETRY_WAIT_TIME * (attempts + 1)

            match status:
                case 200:
                    users_emailed_count += 1
                    percent_done = users_emailed_count / min(active_user_count, remaining_sends) * 100
                    print(
                        f'\r{round(percent_done, 2)}%',
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
                case _:  # default case
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
    """
    Get the list of users to email
    Modify this function to change which users receive emails
    """
    print(f'searching for users active since {ACTIVE_SINCE.date()}')
    eligible_users = (
        User.objects.select_related('extra_details')
        .only('extra_details', 'email', 'username')
        .filter(
            last_login__gte=ACTIVE_SINCE,
            is_active=True,
        )
        .filter(
            *USER_FILTERS,
        )
        .exclude(
            email='',
        )
    )
    for query in USER_EXCLUDE:
        eligible_users = eligible_users.exclude(**query)
    if not force:
        eligible_users = eligible_users.exclude(
            extra_details__isnull=True,
        ).exclude(
            extra_details__private_data__has_key=user_detail_email_key,
        )

    # last step: convert email to lowercase and strip any filters
    # regex finds 'name+filter@example.com' type addresses
    return eligible_users.annotate(email_cleaned=Func(
            Lower(F('email')),
            Value(r'\+\S*@'),
            Value('@'),
            Value(''),
            function='REGEXP_REPLACE',
            output_field=CharField(),
    )).distinct(
        'email_cleaned'
    )


def send_email(user, configuration, template):
    message = build_message(template, user)
    message['To'] = user.email_cleaned
    return ses.send_email(
        FromEmailAddress=FROM_ADDRESS,
        Destination={
            'ToAddresses': [
                user.email_cleaned,
            ],
        },
        Content={
            'Raw': {
                'Data': message.as_string(),
            }
            # 'Template': {
            #         'TemplateName': EMAIL_TEMPLATE_NAME,
            #         'TemplateData': json.dumps(personalized_fields),
            #     },
        },
        ListManagementOptions={
            'ContactListName': CONTACT_LIST,
        },
        **configuration,
    )


def build_message(template, user):
    """
    Build a message from its component parts
    """
    msg = MIMEMultipart('alternative')
    msg['Subject'] = EMAIL_SUBJECT
    msg['From'] = FROM_ADDRESS

    msg.preamble = 'Multipart message.\n'
    for [key, value] in PERSONALIZED_FIELDS.items():
        if field := getattr(user, value):
            # replaces e.g. '{{username}}' with 'myusername'
            needle = '{{' + key + '}}'
            template['Text'] = template['Text'].replace(needle, field)
            template['Html'] = template['Html'].replace(needle, field)

    txt = MIMEText(template['Text'], 'plain')
    html = MIMEText(template['Html'], 'html')

    msg.attach(txt)
    msg.attach(html)
    msg.add_header('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click')
    return msg


def resubscribe_user(email):
    ses.update_contact(
        ContactListName=CONTACT_LIST,
        EmailAddress=email,
        UnsubscribeAll=False,
    )
