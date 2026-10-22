const ABBREVIATIONS = [
  'Mr',
  'Mrs',
  'Ms',
  'Dr',
  'St',
  'Prof',
  'e.g',
  'i.e',
  'etc',
  'vs',
  'No',
]

const PROTECTED = '\uE000'

/** Split text into sentences without breaking on listed abbreviations, initials, or decimals. */
export function splitSentences(text: string): string[] {
  let protectedText = text

  for (const abbr of ABBREVIATIONS) {
    const escaped = abbr.replace(/\./g, '\\.')
    const re = new RegExp(`\\b${escaped}\\.`, 'gi')
    protectedText = protectedText.replace(re, (match) => match.replace(/\./g, PROTECTED))
  }

  // Single capital initials: "J." or "R."
  protectedText = protectedText.replace(/\b([A-Z])\./g, `$1${PROTECTED}`)

  // Decimals: 3.14
  protectedText = protectedText.replace(/(\d)\.(\d)/g, `$1${PROTECTED}$2`)

  const parts = protectedText.split(/(?<=[.!?])\s+/)
  return parts
    .map((part) => part.split(PROTECTED).join('.').trim())
    .filter((part) => part.length > 0)
}
