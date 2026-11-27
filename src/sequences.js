// Helpers for ID sequences (sealog-server lib/sequences.js)

export const SEQUENCE_SCOPES = ['global', 'cruise']

const pad = (value, width) => String(value).padStart(width, '0')

// The date pieces of formats and placeholders for a date, in UTC
export const dateValues = (date) => ({
  yyyy: String(date.getUTCFullYear()),
  yy: pad(date.getUTCFullYear() % 100, 2),
  mm: pad(date.getUTCMonth() + 1, 2),
  dd: pad(date.getUTCDate(), 2),
  doy: pad(Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1, 3)
})

// An example ID in a sequence's format, with a placeholder cruise ID and
// today's date (see sealog-server lib/sequences.js)
export const sequenceExample = ({ format, start = 1 }) => {
  const values = { cruise_id: 'CRUISE', ...dateValues(new Date()) }

  return format.replace(/\{([a-z_]+)(?::(\d+))?\}/g, (match, token, width) =>
    token === 'n' ? pad(start, Number(width || 0)) : values[token] !== undefined ? values[token] : match
  )
}

// A text option's default value can hold placeholders, with text around
// them, filled in by the server on save: a sequence's ID ({seq:name}), the
// cruise covering the event ({cruise_id}) and the event's date ({yyyy} {yy}
// {mm} {dd} {doy}, UTC), e.g. {seq:ctd_cast}.hex
const PLACEHOLDER_PATTERN = /\{(seq:[A-Za-z0-9_-]{1,64}|cruise_id|yyyy|yy|mm|dd|doy)\}/g

export const DATE_PLACEHOLDERS = ['yyyy', 'yy', 'mm', 'dd', 'doy']

// The placeholders in a text, without braces (e.g. 'seq:ctd_cast', 'yyyy'),
// each once
export const placeholders = (text) => [...new Set([...String(text || '').matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]))]

// The sequence names in a text's placeholders
export const sequenceRefs = (text) =>
  placeholders(text)
    .filter((placeholder) => placeholder.startsWith('seq:'))
    .map((placeholder) => placeholder.slice(4))

// The text with each placeholder replaced by values[placeholder]
export const fillPlaceholders = (text, values) => text.replace(PLACEHOLDER_PATTERN, (match, placeholder) => values[placeholder])
