# Docs Crawler & AI Markdown Generator

A Node.js script that crawls a website from a given base URL, uses an AI model (via OpenAI API) to convert HTML content into Markdown, saves the generated Markdown files, and creates an index file.

## Installation

1.  Clone the repository (if applicable).
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Install Playwright browsers:
    ```bash
    npx playwright install --with-deps
    ```

## Setup

1.  Create a `.env` file in the root directory.
2.  Add your OpenAI API key to the `.env` file:
    ```
    OPENAI_API_KEY=your_api_key_here
    ```

## Usage

The script can be run interactively or by providing command-line arguments.

### Interactive Mode

Run the script without any arguments to be prompted for all options:

```bash
npm start
# or
node index.js
```

### Command-Line Arguments

Provide the `--baseUrl` (or `-b`) argument to skip the interactive prompts. Other options can also be provided as flags, otherwise defaults will be used.

**Basic Example:**

```bash
# Using npm start (note the -- separator)
npm start -- --baseUrl https://docs.example.com/guides

# Using node directly
node index.js --baseUrl https://docs.example.com/guides
```

**Example with More Options:**

```bash
node index.js -b https://docs.example.com/guides -o ./output/markdown -p example-project -e /api,/admin -r -c 5 
```

### Available Options

| Flag           | Alias | Description                                    | Type      | Default            |
| -------------- | ----- | ---------------------------------------------- | --------- | ------------------ |
| `--baseUrl`    | `-b`  | Base URL to crawl                              | `string`  | _None (Required)_  |
| `--outputDir`  | `-o`  | Output directory                               | `string`  | `./docs`           |
| `--projectName`| `-p`  | Project folder name (inside output directory)  | `string`  | _(domain name)_    |
| `--excludePaths`| `-e`  | Comma-separated paths to exclude             | `string`  | `""`               |
| `--shouldRegenerate`| `-r`  | Regenerate existing files?                   | `boolean` | `false`            |
| `--maxConcurrent`| `-c`  | Max concurrent AI requests                   | `string`  | `"2"`              |
| `--help`       | `-h`  | Show help                                      | `boolean` |                    |

## Output

-   The script creates Markdown files corresponding to the crawled pages inside the specified `<outputDir>/<projectName>` directory.
-   An `index.md` file is generated (or updated) in the `<outputDir>/<projectName>` directory, listing the processed pages.

## Regeneration Behavior (`--shouldRegenerate` / `-r`)

-   **Without `-r` (Default):** 
    -   Existing Markdown files in the output directory will *not* be regenerated.
    -   The `index.md` file will be *appended* with entries for any *newly* generated files from this run.
-   **With `-r`:**
    -   All found pages will be processed, and existing Markdown files *will* be overwritten.
    -   The `index.md` file will be completely *overwritten* with a fresh index based on all processed pages from this run.
