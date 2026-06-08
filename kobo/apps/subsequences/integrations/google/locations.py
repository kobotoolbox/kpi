from __future__ import annotations

import constance

from kpi.utils.log import logging


# The server-wide Google region is stored in Constance as either 'US' or 'EU'.
# 'EU' must be used when EU data residency is required (all data must remain
# within Europe). 'US' is the default for all other deployments
GOOGLE_REGION_EU = 'EU'
GOOGLE_REGION_US = 'US'
GOOGLE_REGION_CHOICES = (GOOGLE_REGION_US, GOOGLE_REGION_EU)

DEFAULT_GOOGLE_REGION = GOOGLE_REGION_US

SPEECH_LOCATION_BY_REGION = {
    GOOGLE_REGION_EU: 'eu',
    GOOGLE_REGION_US: 'us',
}

# To maintain strict EU data residency compliance, EU traffic is explicitly
# routed through the dedicated 'translate-eu' multi-regional gateway. This
# guarantees that TLS termination, data in transit, and processing
# (in europe-west1) remain entirely within European borders.
#
# For the default/US region, we utilize the global endpoint to process in
# us-central1, as there are no data residency restrictions and this allows for
# more flexible failover and redundancy options across Google's global infrastructure
TRANSLATE_ENDPOINT_BY_REGION = {
    GOOGLE_REGION_EU: 'translate-eu.googleapis.com',
    GOOGLE_REGION_US: 'translate.googleapis.com',
}

TRANSLATE_LOCATION_BY_REGION = {
    GOOGLE_REGION_EU: 'europe-west1',
    GOOGLE_REGION_US: 'us-central1',
}


def get_google_region() -> str:
    """
    Return the configured ASR/MT Google processing region

    Constance values are editable at runtime, so tolerate lower-case values and
    fall back to the 'US' with a warning if an un-recognized value is set.
    """
    region = str(
        getattr(
            constance.config,
            'ASR_MT_GOOGLE_REGION',
            DEFAULT_GOOGLE_REGION,
        )
    ).upper()
    if region in GOOGLE_REGION_CHOICES:
        return region

    logging.warning(
        'Invalid ASR_MT_GOOGLE_REGION=%s; defaulting to %s',
        region,
        DEFAULT_GOOGLE_REGION,
    )
    return DEFAULT_GOOGLE_REGION


def get_speech_location() -> str:
    return SPEECH_LOCATION_BY_REGION[get_google_region()]


def get_translate_endpoint() -> str:
    return TRANSLATE_ENDPOINT_BY_REGION[get_google_region()]


def get_translate_location() -> str:
    return TRANSLATE_LOCATION_BY_REGION[get_google_region()]
