# Find Commits

A TypeScript utility script to find all commits that touched a specific file and generate a git rebase todo file that marks those commits for editing during an interactive rebase.

## Purpose

This tool is useful when you need to modify commits that affected a particular file. Instead of manually identifying which commits to mark as 'edit' in an interactive rebase, this script automates the process by:

1. Scanning git history for commits that touched a specified file
2. Generating a rebase todo file with those commits marked as 'edit'
3. Providing a helper script to apply the rebase

## Features

- **Automatic commit detection**: Finds all commits that modified a specific file
- **Rebase todo generation**: Creates a properly formatted git rebase instruction file
- **Flexible range**: Supports specifying a base commit or using the entire history
- **Cross-platform**: Works on Windows with Git Bash/MINGW64 via path conversion
- **No dependencies**: Uses only Node.js built-in modules

## Quick Start (Prebuilt)

You can download the prebuilt JavaScript file directly from the gist:
[https://gist.github.com/Mintonne/fe6e7931b95b59b773e12848f005b698](https://gist.github.com/Mintonne/fe6e7931b95b59b773e12848f005b698)

## Installation

Install dependencies:

```bash
npm install
```

## Usage

First build the script:

```bash
npm run build
```

Then run:

```bash
node path/to/find-commits.js <file-path> [base-commit] [-d]
```

### Arguments

- `file-path` (required): Path to the file relative to repository root
- `base-commit` (default: `root`): Base commit to start the rebase from
- `-d`, `--preserve-date` (optional): Preserve original commit dates (--committer-date-is-author-date)
- `-h`, `--help` (optional): Show help message

**NOTE**: This script must be run from the root of the git repository where the target file exists.

### Examples

Find all commits that touched a file from the entire history:

```bash
node path/to/find-commits.js src/utils/validation/index.ts
```

Find commits from the last 5 commits:

```bash
node path/to/find-commits.js src/components/Button.tsx HEAD~5
```

Find commits starting from a specific commit hash:

```bash
node path/to/find-commits.js README.md abc1234
```

Find commits starting from a specific branch:

```bash
node path/to/find-commits.js package.json main
```

Preserve original commit dates during rebase:

```bash
node path/to/find-commits.js src/api/client.ts v1.0.0 --preserve-date
```

## How It Works

1. **Commit Detection**: The script uses `git log` with pathspec globbing to find all commits that touched the specified file
2. **Range Processing**: It retrieves all commits in the specified rebase range in chronological order
3. **Todo Generation**: It creates a rebase todo file where:
   - Commits that touched the file are marked as `edit`
   - All other commits are marked as `pick`
4. **File Output**: Two files are generated in the system temp directory:
   - `rebase-todo.txt`: The rebase instruction file
   - `apply-rebase.sh`: A helper bash script to apply the rebase

## Applying the Rebase

After running the script, it will output the command to apply the rebase:

```bash
GIT_SEQUENCE_EDITOR="cp '/tmp/rebase-todo.txt'" git rebase -i <base-commit>
```

Or run the generated helper script:

```bash
bash /tmp/apply-rebase.sh
```

The rebase will pause at each commit that touched your file, allowing you to make changes.

## Bash Alias

For easier usage, you can copy the compiled file anywhere and add an alias to your bash configuration:

```bash
# Copy the compiled file to a location in your PATH (optional)
cp path/to/find-commits.js /usr/local/bin/find-commits.js

# Add to ~/.bashrc or ~/.zshrc
alias findcommits='node /path/to/find-commits.js'
```

Replace `/path/to/find-commits.js` with the actual path where you placed the compiled file.

After adding the alias, reload your shell:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

Now you can use the command from anywhere:

```bash
findcommits src/components/Button.tsx feature/login
findcommits src/api/client.ts v1.0.0 --preserve-date
```

## Platform Support

- **Windows**: Full support with automatic path conversion for Git Bash/MINGW64
- **macOS/Linux**: Native support

## Technical Details

### Git Commands Used

- `git log --format="%H %s" -- ":(glob)${filePath}"` - Finds commits touching a file
- `git log --reverse` - Gets commits in chronological order for rebase

### Path Conversion

The script includes a `toUnixPath()` function that converts Windows paths (e.g., `C:\path`) to Unix-style paths (e.g., `/c/path`) for compatibility with Git Bash on Windows.

### Output Format

The generated rebase todo file follows git's interactive rebase format:

```
pick <hash> <message>
edit <hash> <message>
pick <hash> <message>
```

## Error Handling

- Validates command-line arguments before processing
- Handles cases where no commits are found for the specified file
- Gracefully handles chmod failures on Windows
- Parses git log output with regex validation
