from datetime import datetime
from typing import TypedDict


class BillingDates(TypedDict):
    start: datetime
    end: datetime


class UsageLimits(TypedDict):
    storage_bytes_limit: float
    submission_limit: float
    asr_seconds_limit: float
    mt_characters_limit: float


class NLPUsage(TypedDict):
    asr_seconds: int
    mt_characters: int
