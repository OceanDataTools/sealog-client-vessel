// Helpers for ID sequences (sealog-server lib/sequences.js)

export const SEQUENCE_SCOPES = ['global', 'cruise']

const pad = (value, width) => String(value).padStart(width, '0')

// An example ID in a sequence's format, with a placeholder cruise ID and
// today's date (see sealog-server lib/sequences.js)
export const sequenceExample = ({ format, start = 1 }) => {
  const now = new Date()
  const values = {
    cruise_id: 'CRUISE',
    yyyy: String(now.getUTCFullYear()),
    yy: pad(now.getUTCFullYear() % 100, 2),
    mm: pad(now.getUTCMonth() + 1, 2),
    dd: pad(now.getUTCDate(), 2),
    doy: pad(Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000) + 1, 3)
  }

  return format.replace(/\{([a-z_]+)(?::(\d+))?\}/g, (match, token, width) =>
    token === 'n' ? pad(start, Number(width || 0)) : values[token] !== undefined ? values[token] : match
  )
}

// A text option's default value can hold sequence IDs as placeholders, with
// text around them, e.g. {seq:ctd_cast}.hex (filled in by the server on save)
const SEQUENCE_REF_PATTERN = /\{seq:([A-Za-z0-9_-]{1,64})\}/g

// The sequence names in a text's placeholders, each once
export const sequenceRefs = (text) => [...new Set([...String(text || '').matchAll(SEQUENCE_REF_PATTERN)].map((match) => match[1]))]

// The text with each {seq:name} replaced by ids[name]
export const fillSequenceRefs = (text, ids) => text.replace(SEQUENCE_REF_PATTERN, (match, name) => ids[name])
