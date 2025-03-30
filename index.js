// Use require for CommonJS modules
const { crawlWebsite } = require("./src/crawler.js");
const fs = require("fs"); // Need synchronous existsSync for easy check
const fsp = require("fs/promises");
const path = require("path");
const yargs = require("yargs/yargs"); // <--- Add back yargs
const { hideBin } = require("yargs/helpers"); // <--- Add back yargs helper
const { generateObject } = require("ai");
const { z } = require("zod");
require("dotenv").config();
const { openai } = require("@ai-sdk/openai");

// --- Constants ---
const MAX_CHUNK_SIZE = 120000; // Max characters per chunk for AI processing
const CONTEXT_OVERLAP_SIZE = 5000; // Characters from previous chunk to include

// --- yargs configuration ---
const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 <startUrl> [options]")
  .command(
    "$0 <startUrl>",
    "Crawl a website starting from startUrl and generate docs",
    (yargs) => {
      yargs.positional("startUrl", {
        describe: "The initial URL to start crawling from",
        type: "string",
      });
    }
  )
  .option("outputDir", {
    describe: "Base output directory path",
    type: "string",
    default: "./docs",
  })
  .option("projectName", {
    describe: "Project folder name (optional, uses domain if blank)",
    type: "string",
    default: "",
  })
  .option("limit", {
    alias: "l",
    type: "number",
    description: "Limit the number of URLs to crawl and generate docs for",
    default: Infinity,
  })
  .option("shouldRestart", {
    type: "boolean",
    description:
      "Overwrite and regenerate the Markdown file if it already exists (default is to skip existing).",
    default: false,
  })
  .option("maxConcurrent", {
    type: "number",
    description: "Maximum number of LLM requests to process concurrently.",
    default: 2,
  })
  .demandCommand(1, "You must provide the startUrl")
  .help()
  .alias("help", "h")
  .strict()
  .parse();

// Get arguments from yargs
const startUrl = /** @type {string} */ (argv.startUrl);
const outputDir = /** @type {string} */ (argv.outputDir);
let projectName = /** @type {string} */ (argv.projectName);
const limit = /** @type {number} */ (argv.limit);
const shouldRestart = /** @type {boolean} */ (argv.shouldRestart);
const maxConcurrent = /** @type {number} */ (argv.maxConcurrent);

// --- URL Validation ---
try {
  new URL(startUrl);
} catch (error) {
  console.error(`Error: Invalid URL format provided: ${startUrl}`);
  process.exit(1);
}

// Helper function to sanitize filenames
function sanitize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumeric characters except hyphens
    .replace(/--+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}

// Helper function to generate filename from URL
function generateFilenameFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    let pathSegments = url.pathname.split("/").filter((segment) => segment); // Split and remove empty segments

    if (pathSegments.length === 0) {
      return "index.md"; // Root path
    }

    // Optional: Handle cases like /docs/page/index -> use 'page' instead of 'index'
    if (
      pathSegments.length > 1 &&
      pathSegments[pathSegments.length - 1] === "index"
    ) {
      pathSegments.pop(); // Remove 'index' if it's not the only segment
    }

    const lastSegment = pathSegments[pathSegments.length - 1];
    const sanitized = sanitize(lastSegment);

    return sanitized ? `${sanitized}.md` : `page-${Date.now()}.md`; // Fallback filename
  } catch (error) {
    console.warn(`Could not parse URL for filename: ${urlString}`, error);
    return `page-${Date.now()}.md`; // Fallback filename on error
  }
}

console.log(`Starting crawl at: ${startUrl}`);
if (limit !== Infinity) {
  console.log(`Limiting crawl to ${limit} URLs.`);
}
console.log(`Concurrency level: ${maxConcurrent}`);
console.log(`Overwrite existing files (--shouldRestart): ${shouldRestart}`);

// --- Main Process ---
(async () => {
  // Wrap in async IIFE
  try {
    // Determine domain/project name for subdirectory
    let domainOrProjectName = "unknown-site";
    if (!projectName) {
      try {
        const parsedUrl = new URL(startUrl);
        domainOrProjectName = parsedUrl.hostname.replace(/^www\./, "");
      } catch {
        /* ignore */
      }
    } else {
      domainOrProjectName = sanitize(projectName);
    }

    const baseDocsDir = path.resolve(process.cwd(), outputDir);
    const siteDocsDir = path.join(baseDocsDir, domainOrProjectName);

    try {
      await fsp.mkdir(siteDocsDir, { recursive: true });
      console.log(`Output directory: ${siteDocsDir}`);
    } catch (dirError) {
      console.error(`Error creating directories: ${dirError}`);
      process.exit(1);
    }

    console.log("Starting crawl...");
    const collectedData = await crawlWebsite(startUrl, limit);
    console.log("Crawling complete!");

    /** @type {Map<string, string | null>} */
    const dataMap = collectedData;

    if (!dataMap || dataMap.size === 0) {
      console.warn("Crawl finished but received no data.");
      process.exit(0);
    }

    console.log(
      `\nStarting documentation generation for ${dataMap.size} pages...`
    );

    // --- Define Zod Schema and Prompt (remains the same) ---
    const docSchema = z.object({
      title: z
        .string()
        .describe(
          "A concise, informative title for the documentation page, suitable for filename and index. If processing a chunk with overlap, this should reflect the overall page title."
        ),
      description: z
        .string()
        .describe(
          "A brief (1-2 sentence) description of the page's main content for the index. If processing a chunk with overlap, this should reflect the overall page description."
        ),
      markdownContent: z
        .string()
        .describe(
          "The documentation content from the *current* chunk, formatted as GitHub Flavored Markdown. If the input contained overlap context, ensure a seamless continuation and DO NOT repeat the overlap context in the output."
        ),
    });

    const generationPrompt = `Analyze the following HTML body content from a documentation page. If the content includes a marker like '--- Overlap End / Current Chunk Start ---', the preceding text is context from the end of the previous chunk. \n\nInstructions:\n1. Extract the core technical documentation from the current chunk (after the overlap marker, if present).\n2. Generate a concise title and a short description representing the *entire page's* content (use context if available).\n3. Format the extracted content from the *current chunk only* as clean, well-structured GitHub Flavored Markdown.\n4. Ensure a seamless continuation from previous content if overlap context was provided, but DO NOT repeat the overlap context itself in the generated markdownContent.\n5. Exclude HTML header/footer/navigation elements and unrelated sidebars or ads.\n\nHTML Content Chunk:`;

    // --- Process URLs Concurrently with Skipping ---
    const indexEntries = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const tasks = [];
    for (const [url, bodyHTML] of dataMap.entries()) {
      if (!bodyHTML) {
        skippedCount++;
        continue;
      }
      const filename = generateFilenameFromUrl(url);
      const filePath = path.join(siteDocsDir, filename);
      const relativePath = path.relative(baseDocsDir, filePath);

      if (!shouldRestart && fs.existsSync(filePath)) {
        console.log(
          `Skipping ${url} - output file ${relativePath} already exists (use --shouldRestart to overwrite).`
        );
        skippedCount++;
        indexEntries.push({
          title: filename.replace(".md", ""),
          description: "(Existing file, skipped generation)",
          path: relativePath,
        });
        continue;
      }
      tasks.push({ url, bodyHTML, filePath, relativePath, filename }); // Include filename for error case
    }

    console.log(
      `Executing ${tasks.length} generation tasks with max concurrency ${maxConcurrent}...`
    );

    // --- Run tasks with concurrency limit (Manual Runner) ---
    const activePromises = new Set();
    let taskIndex = 0;

    const runTask = async () => {
      while (taskIndex < tasks.length) {
        if (activePromises.size >= maxConcurrent) {
          await Promise.race(activePromises);
        }

        const currentTaskIndex = taskIndex++;
        const { url, bodyHTML, filePath, relativePath, filename } =
          tasks[currentTaskIndex];

        const taskLogic = async () => {
          console.log(
            `[${currentTaskIndex + 1}/${
              tasks.length
            }] Processing: ${relativePath}`
          );
          let finalTitle = "Untitled Doc";
          let finalDescription = "No description available.";
          let combinedMarkdownContent = "";
          try {
            const bodyLength = bodyHTML.length;
            const needsChunking = bodyLength > MAX_CHUNK_SIZE;
            if (needsChunking) {
              console.log(`  -> Chunking ${relativePath}...`);
              const chunks = [];
              let currentIndex = 0;
              const breakSearchWindow = 500;
              while (currentIndex < bodyLength) {
                let endIndex = Math.min(
                  currentIndex + MAX_CHUNK_SIZE,
                  bodyLength
                );
                if (endIndex < bodyLength) {
                  let bestBreakPoint = -1;
                  const searchStart = Math.max(
                    currentIndex,
                    endIndex - breakSearchWindow
                  );
                  const sentenceEndings = [
                    ". ",
                    ".\\n",
                    "! ",
                    "!\\n",
                    "? ",
                    "?\\n",
                    "\\n",
                  ];
                  for (const ending of sentenceEndings) {
                    const breakPoint = bodyHTML.lastIndexOf(
                      ending,
                      endIndex - 1
                    );
                    if (breakPoint !== -1 && breakPoint >= searchStart) {
                      bestBreakPoint = Math.max(
                        bestBreakPoint,
                        breakPoint + ending.length
                      );
                    }
                  }
                  if (bestBreakPoint !== -1 && bestBreakPoint > currentIndex) {
                    endIndex = bestBreakPoint;
                  }
                }
                const chunk = bodyHTML.substring(currentIndex, endIndex);
                chunks.push(chunk);
                currentIndex = endIndex;
              }
              console.log(`  -> Split into ${chunks.length} chunks.`);

              let previousChunkContent = null;
              for (let i = 0; i < chunks.length; i++) {
                console.log(
                  `    -> Processing chunk ${i + 1}/${chunks.length}...`
                );
                const currentChunk = chunks[i];
                let promptInputHtml = "";
                if (i > 0 && previousChunkContent) {
                  const overlapStartIndex = Math.max(
                    0,
                    previousChunkContent.length - CONTEXT_OVERLAP_SIZE
                  );
                  const overlapContext =
                    previousChunkContent.substring(overlapStartIndex);
                  promptInputHtml = `${overlapContext}\\n\\n--- Overlap End / Current Chunk Start ---\\n\\n${currentChunk}`;
                } else {
                  promptInputHtml = currentChunk;
                }
                const { object: generatedChunkDoc } = await generateObject({
                  model: openai("gpt-4o-mini"),
                  schema: docSchema,
                  prompt: `${generationPrompt}\\n\\n${promptInputHtml}`,
                });
                if (i === 0) {
                  finalTitle = generatedChunkDoc.title;
                  finalDescription = generatedChunkDoc.description;
                  combinedMarkdownContent += generatedChunkDoc.markdownContent;
                } else {
                  combinedMarkdownContent +=
                    "\\n\\n" + generatedChunkDoc.markdownContent;
                }
                previousChunkContent = currentChunk;
              }
            } else {
              console.log(`  -> Processing ${relativePath} as single chunk.`);
              const { object: generatedDoc } = await generateObject({
                model: openai("gpt-4o-mini"),
                schema: docSchema,
                prompt: `${generationPrompt}\\n\\n${bodyHTML}`,
              });
              finalTitle = generatedDoc.title;
              finalDescription = generatedDoc.description;
              combinedMarkdownContent = generatedDoc.markdownContent;
            }
            await fsp.writeFile(filePath, combinedMarkdownContent);
            console.log(`  -> Saved: ${relativePath}`);
            indexEntries.push({
              title: finalTitle,
              description: finalDescription,
              path: relativePath,
            });
            successCount++;
          } catch (genError) {
            errorCount++;
            console.error(
              `  -> Failed: ${relativePath} - ${
                genError instanceof Error ? genError.message : genError
              }`
            );
            indexEntries.push({
              title: filename,
              description: `(Failed generation: ${
                genError instanceof Error ? genError.message : genError
              })`,
              path: relativePath + ".error",
            });
          }
        };

        const promise = taskLogic()
          .catch((err) => {
            console.error(`Critical error in task runner for ${url}: ${err}`);
          })
          .finally(() => {
            activePromises.delete(promise);
          });
        activePromises.add(promise);
      }
      await Promise.allSettled(Array.from(activePromises));
    };

    await runTask();

    console.log(
      `\nDocumentation generation finished. Success: ${successCount}, Failed: ${errorCount}, Skipped: ${skippedCount}`
    );

    // --- Generate index.md ---
    if (indexEntries.length > 0) {
      console.log("Generating index file...");
      const indexFilePath = path.join(siteDocsDir, "index.md");
      let indexContent = `# Documentation Index for ${domainOrProjectName}\n\n`;
      indexContent += `Generated from ${startUrl}\n\n`;
      indexEntries.sort((a, b) => a.path.localeCompare(b.path));
      indexContent += indexEntries
        .map(
          (entry) =>
            `- ${entry.title}\n  - Path to file: ${entry.path}\n  - Description: ${entry.description}`
        )
        .join("\n\n");

      try {
        await fsp.writeFile(indexFilePath, indexContent);
        console.log(
          `Successfully wrote index file: ${path.relative(
            baseDocsDir,
            indexFilePath
          )}`
        );
      } catch (indexError) {
        console.error(`Error writing index file ${indexFilePath}:`, indexError);
      }
    }
    console.log("All done!"); // Simple final message
  } catch (error) {
    console.error("\nAn unexpected error occurred during the process:", error);
    if (error instanceof Error && error.stack) {
      console.error("Stack Trace:\n", error.stack);
    }
    process.exit(1);
  }
})(); // End IIFE
