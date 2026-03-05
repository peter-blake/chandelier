type LogEvent =
  | 'payment_verified'
  | 'exa_complete'
  | 'claude_complete'
  | 'response_delivered'
  | 'pipeline_error'
  | 'dead_letter'

interface LogEntry {
  event: LogEvent
  bulb?: string
  idempotency_key?: string
  ts: string
  [key: string]: unknown
}

export function log(entry: Omit<LogEntry, 'ts'>): void {
  const output: LogEntry = {
    ...entry,
    ts: new Date().toISOString(),
  }
  process.stdout.write(JSON.stringify(output) + '\n')
}
