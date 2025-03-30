# Docs Crawler (JavaScript Version)

A simple website crawler built with Node.js and Playwright to find all sub-paths under a given starting URL. Uses JSDoc for type annotations.

## Installation

1. Clone the repository (if applicable).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install --with-deps
   ```

## Usage

Run the crawler by providing the starting URL as a command-line argument:

```bash
npm start -- <starting_url>
```

Alternatively, run directly with Node:

```bash
node index.js <starting_url>
```

**Example:**

```bash
npm start -- https://docs.example.com/guides
# or
node index.js https://docs.example.com/guides
```

The script will output the URLs found during the crawl to the console and finish by writing all unique URLs (one per line) discovered under the specified starting path to `collected_urls.txt`.
