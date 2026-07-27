function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Today's date in the device's local timezone, not UTC. */
export function todayAsFilenameBase(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// Characters invalid in filenames on Windows (also covers macOS's sole
// restriction, ':') plus control characters, since files exported here may
// land on either OS via download or share.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\x00-\x1f<>:"/\\|?*]/g

function sanitize(name: string): string {
  return name.replace(UNSAFE_CHARS, ' ').trim().replace(/\s+/g, ' ')
}

/** Resolves the user-entered export name to a safe filename base — falls back to today's date (yyyy-mm-dd) when left blank or left with nothing usable after stripping unsafe characters. */
export function resolveFilenameBase(input: string): string {
  const cleaned = sanitize(input)
  return cleaned.length > 0 ? cleaned : todayAsFilenameBase()
}
