import string

MAX_REPEATED_NGRAM_WORDS = 5


def collapse_runaway_repetitions(
    text: str,
    max_repeats: int,
    max_ngram: int = MAX_REPEATED_NGRAM_WORDS,
) -> str:
    """
    Clamp pathological consecutive n-gram runs in a transcript

    Automatic speech recognition models can get stuck in a decoder loop and
    fill the transcript with one short phrase repeated hundreds of times. Any
    n-gram (for n from 1 to `max_ngram`) that repeats more than `max_repeats`
    consecutive times is trimmed to its first `max_repeats` occurrences.

    Comparison is case-insensitive and ignores leading/trailing punctuation so
    that a loop drifting in casing or punctuation still counts as one run; the
    kept occurrences preserve their original spelling. When nothing is trimmed,
    the original `text` object is returned unchanged so clean transcripts are
    byte-identical (whitespace is never re-normalized).
    """
    if max_repeats <= 0 or not text.strip():
        return text

    tokens = text.split()
    keys = [token.casefold().strip(string.punctuation) for token in tokens]
    trimmed = False

    for n in range(1, max_ngram + 1):
        kept_tokens: list[str] = []
        kept_keys: list[str] = []
        i = 0
        length = len(keys)
        while i < length:
            end = i + n
            ngram = keys[i:end]
            if len(ngram) < n:
                kept_tokens.append(tokens[i])
                kept_keys.append(keys[i])
                i += 1
                continue

            run = 1
            j = end
            nxt = j + n
            while keys[j:nxt] == ngram:
                run += 1
                j = nxt
                nxt = j + n

            if run > max_repeats:
                trimmed = True
                keep_end = i + max_repeats * n
                kept_tokens.extend(tokens[i:keep_end])
                kept_keys.extend(keys[i:keep_end])
            elif run > 1:
                kept_tokens.extend(tokens[i:j])
                kept_keys.extend(keys[i:j])
            else:
                kept_tokens.append(tokens[i])
                kept_keys.append(keys[i])
                i += 1
                continue

            i = j

        tokens = kept_tokens
        keys = kept_keys

    if not trimmed:
        return text

    return ' '.join(tokens)
