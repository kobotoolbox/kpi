# coding: utf-8

def format_exception_values(values: list, sep: str = 'or') -> str:
    return "{} {} '{}'".format(
        ', '.join([f"'{v}'" for v in values[:-1]]), sep, values[-1]
    )

