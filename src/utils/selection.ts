// Every option picked, keeping picked values that aren't offered now
export function selectAll(value: string[], options: string[]): string[] {
  return [...new Set([...value, ...options])]
}

// None of the options picked, keeping picked values that aren't offered now
export function clearAll(value: string[], options: string[]): string[] {
  return value.filter((item) => !options.includes(item))
}
