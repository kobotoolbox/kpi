import six
from google.cloud import translate_v2 as translate


def run(*args):
    text = args[0]
    target = args[1]

    translate_client = translate.Client()

    if isinstance(text, six.binary_type):
        text = text.decode("utf-8")

    result = translate_client.translate(text, target_language=target)

    print(u"Translation: {}".format(result["translatedText"]))
