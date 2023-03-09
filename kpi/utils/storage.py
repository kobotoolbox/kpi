import logging
from pathlib import Path

from django.core.files.storage import default_storage, FileSystemStorage


def rmdir(directory: str):
    for base, subfolders, files in walkdir(default_storage, directory):
        for file in files:
            default_storage.delete(f'{base}/{file}')
        for subfolder in subfolders:
            default_storage.delete(f'{base}/{subfolder}/')


def walkdir(storage, base='/', error_handler=None):
    """
    @source https://gist.githubusercontent.com/dvf/c103e697dab77c304d39d60cf279c500/raw/87102dbcae6dfa17ac328b83057f8fb6061dba9d/walk_folders.py
    """
    try:
        folders, files = storage.listdir(base)
    except OSError as e:
        logging.exception(f'An error occurred while walking directory {base}')
        if error_handler:
            error_handler(e)
        return

    for subfolder in folders:
        # On S3 and Azure, we don't really have subfolders, so exclude "."
        if not isinstance(storage, FileSystemStorage) and subfolder == ".":
            continue

        new_base = str(Path(base, subfolder))
        for f in walkdir(storage, new_base):
            yield f

    yield base, folders, files
