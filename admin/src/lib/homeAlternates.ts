// The four marketing homepages name each other, so Google serves the right
// language and does not treat them as duplicates. ONE list: each page used to
// carry its own copy, and a page missing from one copy is a page Google is
// told is not a translation.
export const HOME_LANGUAGES = {
  en: "https://vascobuild.com",
  "en-US": "https://vascobuild.com/us",
  nl: "https://vascobuild.com/nl",
  de: "https://vascobuild.com/de",
  "x-default": "https://vascobuild.com",
} as const;
