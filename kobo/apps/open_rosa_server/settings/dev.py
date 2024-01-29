# coding: utf-8
from .base import *

################################
# KoBoCAT settings             #
################################

# Expiration time in sec. after which the hash of paired data xml file should be
# validated.
# Does not need to match KPI setting
PAIRED_DATA_EXPIRATION = 5

# Minimum size (in bytes) of files to allow fast calculation of hashes
# Should match KPI setting
HASH_BIG_FILE_SIZE_THRESHOLD = 200 * 1024  # 200 kB

# Chunk size in bytes to read per iteration when hash of a file is calculated
# Should match KPI setting
HASH_BIG_FILE_CHUNK = 5 * 1024  # 5 kB
