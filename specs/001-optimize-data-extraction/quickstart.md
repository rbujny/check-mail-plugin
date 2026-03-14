# Quickstart: Testing The Extraction Process

A straightforward way to validate this feature is to mock an email response locally within the browser devtools and log out the newly defined payload.

1. Locate the test injection in the DOM Console where the Content Script runs.
2. Provide a mock raw email snippet featuring large `arc-seal` keys and multiple links in the body.
3. Call the `parseHeaders` and `optimizeBody` methods locally.
4. Verify that `ProcessedEmailData` size is considerably smaller than the initial raw text.
5. Confirm that the `links` string array correctly holds the distinct URLs while the body text shows `[LINK]`.
