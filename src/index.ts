/**
 * Script to find all commits that touched a file and mark them as 'edit' for git rebase.
 *
 * Build: npm run build
 * Usage: node path/to/find-commits.js <file-path> [base-commit] [-d] [-h|--help]
 *
 * Arguments:
 *   file-path   - Path to the file (relative to repo root)
 *   base-commit - Optional: base commit to start from (default: root)
 *   -d, --preserve-date  - Optional: preserve original dates (--committer-date-is-author-date)
 *   -h, --help  - Show help message
 *
 * This generates a rebase-todo file that you can use with:
 *   GIT_SEQUENCE_EDITOR="cat rebase-todo.txt >" git rebase -i <base-commit>
 */

import { tmpdir } from 'os'
import { resolve } from 'path'
import { execSync } from 'child_process'
import { writeFileSync, chmodSync } from 'fs'

interface CommitInfo {
  hash: string
  shortHash: string
  message: string
}

function toUnixPath(winPath: string) {
  // Convert C:\path to /c/path for MINGW64 bash
  return winPath.replace(/^([A-Z]):/i, (_, letter) => `/${letter.toLowerCase()}`).replace(/\\/g, '/')
}

function getCommitsForPath(filePath: string, baseCommit?: string) {
  const range = baseCommit ? `${baseCommit}..HEAD` : ''
  const command = range ? `git log ${range} --oneline --format="%H %s" -- ":(glob)${filePath}"` : `git log --oneline --format="%H %s" -- ":(glob)${filePath}"`

  const output = execSync(command, { encoding: 'utf-8' }).trim()

  if (!output) {
    return []
  }

  return output.split('\n').map((line: string) => {
    const match = line.match(/^([a-f0-9]+)\s+(.+)$/)
    if (!match) {
      throw new Error(`Failed to parse log line: ${line}`)
    }
    return {
      hash: match[1],
      shortHash: match[1].substring(0, 7),
      message: match[2]
    }
  })
}

function getAllCommitsForRebase(baseCommit?: string) {
  const range = baseCommit ? `${baseCommit}..HEAD` : ''
  const command = range ? `git log ${range} --oneline --format="%H %s" --reverse` : `git log --oneline --format="%H %s" --reverse`

  const output = execSync(command, { encoding: 'utf-8' }).trim()

  if (!output) {
    return []
  }

  return output.split('\n').map((line: string) => {
    const match = line.match(/^([a-f0-9]+)\s+(.+)$/)
    if (!match) {
      throw new Error(`Failed to parse log line: ${line}`)
    }
    return {
      hash: match[1],
      shortHash: match[1].substring(0, 7),
      message: match[2]
    }
  })
}

function generateRebaseTodo(allCommits: CommitInfo[], editCommitHashes: Set<string>) {
  const lines: string[] = []

  for (const commit of allCommits) {
    const action = editCommitHashes.has(commit.hash) ? 'edit' : 'pick'
    lines.push(`${action} ${commit.hash} ${commit.message}`)
  }

  return lines.join('\n')
}

function showHelp() {
  console.log('Usage: node path/to/find-commits.js <file-path> [base-commit] [-d]')
  console.log('')
  console.log('Arguments:')
  console.log('  file-path   - Path to the file (relative to repo root)')
  console.log('  base-commit - Optional: base commit to start from (default: root)')
  console.log('  -d, --preserve-date  - Optional: preserve original dates (--committer-date-is-author-date)')
  console.log('  -h, --help  - Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  node path/to/find-commits.js src/utils/validation/index.ts')
  console.log('  node path/to/find-commits.js src/api/client.ts feature/multi-sync -d')
}

function main() {
  const args = process.argv.slice(2)
  const helpFlags = ['-h', '--help']
  const preserveDateFlags = ['-d', '--preserve-date']
  const flags = [...helpFlags, ...preserveDateFlags]

  const hasFlag = (flagGroup: string[]) => flagGroup.some((flag) => args.includes(flag))

  if (args.length < 1 || hasFlag(helpFlags)) {
    showHelp()
    process.exit(args.length < 1 ? 1 : 0)
  }

  // Filter out flags to get positional arguments
  const positionalArgs = args.filter((arg) => !flags.includes(arg))

  if (positionalArgs.length < 1) {
    console.log('Error: No file path provided.')
    console.log('')
    showHelp()
    process.exit(1)
  }

  const filePath = positionalArgs[0]
  const baseCommit = positionalArgs[1]
  const preserveDate = hasFlag(preserveDateFlags)

  console.log(`Finding commits that touched: ${filePath}`)
  console.log(`Preserve dates: ${preserveDate}`)

  if (baseCommit) {
    console.log(`Base commit: ${baseCommit}`)
  }

  console.log('')

  // Get commits that touched the file
  const fileCommits = getCommitsForPath(filePath, baseCommit)

  if (fileCommits.length === 0) {
    console.log('No commits found that touched this file.')
    process.exit(0)
  }

  console.log(`Found ${fileCommits.length} commit(s) that touched the file:`)

  fileCommits.forEach((c) => {
    console.log(`  ${c.hash} ${c.message}`)
  })

  console.log('')

  console.log('Preparing rebase...')

  // Get all commits for the rebase range
  const allCommits = getAllCommitsForRebase(baseCommit)
  const editHashes = new Set(fileCommits.map((c) => c.hash))

  // Generate rebase todo
  const rebaseTodo = generateRebaseTodo(allCommits, editHashes)

  // Write todo file
  const tempDir = tmpdir()
  const outputPath = resolve(tempDir, 'rebase-todo.txt')
  const scriptPath = resolve(tempDir, 'apply-rebase.sh')

  writeFileSync(outputPath, rebaseTodo + '\n')

  // Write a helper script for MINGW64 bash
  const unixOutputPath = toUnixPath(outputPath)
  const rebaseFlag = preserveDate ? '--committer-date-is-author-date' : ''
  const scriptContent = `#!/bin/bash
# Auto-generated rebase script
GIT_SEQUENCE_EDITOR="cp '${unixOutputPath}'" git rebase -i ${rebaseFlag} ${baseCommit || '--root'}
`

  writeFileSync(scriptPath, scriptContent)

  try {
    chmodSync(scriptPath, 0o755)
  } catch {
    // chmod may fail on Windows, that's okay
  }

  console.log(`Generated files in temp directory:`)
  console.log(`  Todo: ${outputPath}`)
  console.log(`  Script: ${scriptPath}`)
  console.log('')
  console.log('To apply this rebase, run:')
  const rebaseFlagDisplay = preserveDate ? ' --committer-date-is-author-date' : ''
  console.log(`  GIT_SEQUENCE_EDITOR="cp '${unixOutputPath}'" git rebase -i${rebaseFlagDisplay} ${baseCommit || '--root'}`)
}

main()
