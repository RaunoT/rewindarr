import { randomBytes } from 'crypto'
import fs from 'fs/promises'

// The code Node gives a failed file operation, like `ENOENT`
export function getErrorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error
    ? String(error.code)
    : undefined
}

// Replaces the file in one step, so a restart halfway through a write still
// finds the previous one
export async function replaceFile(
  filePath: string,
  content: string | Buffer,
): Promise<void> {
  const tempPath = `${filePath}.${randomBytes(4).toString('hex')}.tmp`

  try {
    await fs.writeFile(tempPath, content)
    await fs.rename(tempPath, filePath)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)

    throw error
  }
}
