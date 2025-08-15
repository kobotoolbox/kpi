## List the languages accessible to requesting (authenticated) user.

Search can be made with `q` parameter. By default, search for the term in language names or language codes.

Examples:
```shell
  curl -X GET https://kf.kobotoolbox.org/api/v2/languages/?q=fr
```

Complex searches can be done on other fields, such as `transcription_services` and `translation_services`.

Examples:
```shell
  curl -X GET https://kf.kobotoolbox.org/api/v2/languages/?q=transcription_services__code:goog AND translation_services__code:goog
```

Results are order by `featured` first (descending order), then by their name.
