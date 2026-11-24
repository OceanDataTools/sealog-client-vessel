// Helpers for ID sequences (sealog-server lib/sequences.js)

export const SEQUENCE_SCOPES = ['global', 'cruise', 'lowering']

const pad = (value, width) => String(value).padStart(width, '0')

// An example ID in a sequence's format, with placeholder cruise and lowering
// IDs and today's date (see sealog-server lib/sequences.js)
export const sequenceExample = ({ format, start = 1 }) => {
  const now = new Date()
  const values = {
    cruise_id: 'CRUISE',
    lowering_id: 'LOWERING',
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
