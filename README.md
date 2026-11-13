# myavakasha

An installable web app for students in Karnataka after Class 10. Scan a marksheet or certificate on your phone, build a profile on the phone, and see jobs, courses and scholarships you may qualify for.

- Profiles are stored only on the phone. Photos are read on the phone and not saved.
- Opportunity records are in `data/records.json`. Each has a source, the date it was read, and a confidence level. They come from news and listing pages, not official notices, so check the official site before applying.
- To publish a change, edit the files and raise `VERSION` in `sw.js` so phones pick up the update.

Reading text from photos uses Tesseract.js (Apache 2.0), included in `vendor/tesseract`.
