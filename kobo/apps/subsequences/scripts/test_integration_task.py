from kobo.apps.subsequences.models import SubmissionExtras

from pprint import pprint


def run():
    most_recent_submission = SubmissionExtras.objects.last()
    asset = most_recent_submission.asset
    features = [*asset.advanced_features.keys()]
    first_xpath = [*most_recent_submission.content.keys()][0]

    print('\nfeatures:', features)

    has_ts = True

    def _rm_key(mrs, xp, key):
        del mrs.content[xp][key]

    if 'transcript' in asset.advanced_features:
        if 'googlets' in most_recent_submission.content[first_xpath]:
            _rm_key(most_recent_submission, first_xpath, 'googlets')
            has_ts = False
        else:
            most_recent_submission.content[first_xpath]['googlets'] = {
                'status': 'requested',
            }
        most_recent_submission.save()
    if 'translated' in asset.advanced_features:
        if has_ts and 'googletx' in most_recent_submission.content[first_xpath]:
            _rm_key(most_recent_submission, first_xpath, 'googletx')
        elif has_ts:
            most_recent_submission.content[first_xpath]['googletx'] = {
                'status': 'requested',
            }
        most_recent_submission.save()

    pprint(most_recent_submission.content)
