"use strict";

// --- Core Requires ---
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import "dotenv/config";
import logUpdate from "log-update";
import isUnicodeSupported from "is-unicode-supported";

// --- AI and Prompts ---
import * as p from "@clack/prompts";
import color from "picocolors";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// --- Constants ---
const MAX_CHUNK_SIZE = 120000;
const CONTEXT_OVERLAP_SIZE = 5000;

// --- Clack Icons/Symbols ---
const unicode = isUnicodeSupported();
const s = (c, fallback) => (unicode ? c : fallback);

// State Icons (matching clack/prompts src/index.ts)
const S_STEP_ACTIVE = s("◆", "*"); // Used for Success in notes/logs, maybe for our Success?
const S_STEP_CANCEL = s("■", "x"); // Often used for Error/Cancel
const S_RADIO_INACTIVE = s("○", " "); // Good for Pending/Skipped

// Let's choose the most appropriate ones for our states:
const ICONS = {
  PENDING: S_RADIO_INACTIVE, // ○
  SKIPPED: S_RADIO_INACTIVE, // ○ (like pending, but yellow)
  GENERATING: "", // Will be handled by spinner frames
  SAVING: "💾", // Keeping this one
  SUCCESS: S_STEP_ACTIVE, // ◆
  ERROR: S_STEP_CANCEL, // ■
};

// Spinner (matching clack/prompts src/index.ts)
const SPINNER_FRAMES = unicode ? ["◒", "◐", "◓", "◑"] : ["•", "o", "O", "0"];
const SPINNER_DELAY = unicode ? 80 : 120;
let spinnerFrameIndex = 0;
let spinnerInterval = null;

// --- Helper Functions ---

/**
 * Normalizes a URL string by removing the hash and trailing slash.
 * @param {string} urlString The URL string to normalize.
 * @param {string} [baseUrl] Optional base URL for resolving relative URLs.
 * @returns {string} The normalized URL string, or the original string if normalization fails.
 */
function normalizeUrl(urlString, baseUrl) {
  try {
    const url = new URL(urlString, baseUrl); // Use baseUrl if provided for relative URLs
    url.hash = "";
    let normalized = url.toString();
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch (error) {
    // console.warn(`Failed to normalize URL: ${urlString}`, error);
    return urlString; // Return original on error
  }
}

function sanitize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function generateFilenameFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    let pathSegments = url.pathname.split("/").filter((segment) => segment);
    if (pathSegments.length === 0) {
      return "index.md";
    }
    if (
      pathSegments.length > 1 &&
      pathSegments[pathSegments.length - 1] === "index"
    ) {
      pathSegments.pop();
    }
    const lastSegment = pathSegments[pathSegments.length - 1];
    const sanitized = sanitize(lastSegment);
    return sanitized ? `${sanitized}.md` : `page-${Date.now()}.md`;
  } catch (error) {
    // Use console.warn for non-critical issues
    console.warn(`Could not parse URL for filename: ${urlString}`, error);
    return `page-${Date.now()}.md`;
  }
}
function cleanAndParseJson(rawText) {
  // Simplified JSON cleaning and parsing logic
  if (!rawText) {
    throw new Error("Received empty response from model");
  }
  let cleanedText = rawText.trim();

  // Remove Markdown code fences if present
  const fenceMatch = cleanedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && fenceMatch[1]) {
    cleanedText = fenceMatch[1].trim();
  }

  // Basic check for JSON structure
  if (!cleanedText.startsWith("{") || !cleanedText.endsWith("}")) {
    // Attempt to find the first '{' and last '}'
    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error(
        "Response doesn't appear to be valid JSON (missing braces)"
      );
    }
  }

  try {
    return JSON.parse(cleanedText);
  } catch (parseError) {
    // Log detailed error info separately for debugging
    console.error("\n--- JSON Parsing Error ---");
    console.error("Failed to parse JSON from model response.");
    console.error("Parse Error:", parseError.message);
    console.error("Cleaned text before parse:", cleanedText);
    // console.error("Original raw text:", rawText); // Optionally log original
    console.error("--- End JSON Parsing Error ---\n");
    // Provide a user-friendly error message
    throw new Error(
      `Failed to parse JSON response (check console for details)`
    );
  }
}

// --- Zod Schema and Prompt ---
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
const generationPrompt = `Analyze the following HTML body content from a documentation page. If the content includes a marker like '--- Overlap End / Current Chunk Start ---', the preceding text is context from the end of the previous chunk.

Instructions:
1. Extract the core technical documentation from the current chunk (after the overlap marker, if present).
2. Generate a concise title and a short description representing the *entire page's* content (use context if available).
3. Format the extracted content from the *current chunk only* as clean, well-structured GitHub Flavored Markdown.
4. Ensure a seamless continuation from previous content if overlap context was provided, but DO NOT repeat the overlap context itself in the generated markdownContent.
5. Exclude HTML header/footer/navigation elements and unrelated sidebars or ads.

HTML Content Chunk:`;

// --- Initialize AI Client ---
// Ensure OPENAI_API_KEY is loaded from .env
if (!process.env.OPENAI_API_KEY) {
  console.error(color.red("Error: OPENAI_API_KEY not set in .env file."));
  process.exit(1);
}
const aiClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // baseURL: "...", // Optional: for local models etc.
});
const modelName = "gpt-4o-mini"; // Or your preferred model

// --- Task State Management and Rendering ---
let tasksState = {};
const indexEntries = [];
let generationStats = { success: 0, error: 0, skipped: 0 };
let globalOptions = {};
let globalPaths = { baseDocsDir: null, siteDocsDir: null };

// --- Crawler Function (Moved from src/crawler.js) ---
/**
 * Crawls a website starting from a given URL and collects all unique sub-path URLs
 * along with their body HTML content, up to a specified limit.
 *
 * @param {string} startUrl The URL to start crawling from.
 * @param {number} [limit=Infinity] The maximum number of URLs to collect data for.
 * @param {string[]} [excludePaths=[]] An array of path prefixes to exclude.
 * @returns {Promise<Map<string, string | null>>} A Promise that resolves to a Map where keys are
 *   normalized URLs and values are the body HTML string or null if fetching failed.
 */
async function crawlWebsite(startUrl, limit = Infinity, excludePaths = []) {
  // IMPORTANT: Need to import playwright within this function scope
  // because it was originally imported in the separate crawler file.
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const collectedData = new Map();
  const normalizedStartUrl = normalizeUrl(startUrl);
  const queue = new Set();
  const originUrl = new URL(normalizedStartUrl);
  const siteOrigin = originUrl.origin;
  const basePath =
    originUrl.pathname === "/" ? "/" : originUrl.pathname.replace(/\/?$/, "");

  const startUrlPath = originUrl.pathname;
  const startPathSegments = startUrlPath.split("/").filter(Boolean);
  const isStartExcluded = excludePaths.some((exPath) => {
    const cleanExPath = exPath.replace(/^\/+|\/+$/g, "").trim();
    return cleanExPath && startPathSegments.includes(cleanExPath);
  });

  if (!isStartExcluded) {
    queue.add(normalizedStartUrl);
  } else {
    p.log.warn(
      `Skipping start URL ${normalizedStartUrl} as it matches exclusion rules.`
    );
  }

  while (queue.size > 0 && collectedData.size < limit) {
    const currentUrlFromQueue = queue.values().next().value;
    queue.delete(currentUrlFromQueue);
    const currentNormalizedUrl = currentUrlFromQueue;

    if (collectedData.has(currentNormalizedUrl)) {
      continue;
    }

    let bodyHTML = null;
    try {
      await page.goto(currentNormalizedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      bodyHTML = await page.evaluate(() => document.body?.innerHTML ?? "");

      if (collectedData.size + 1 < limit) {
        const links = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll("a[href]"),
            (a) => /** @type {HTMLAnchorElement} */ (a).href
          )
        );
        for (const link of links) {
          const discoveredNormalizedUrl = normalizeUrl(
            link,
            currentNormalizedUrl
          );
          try {
            const discoveredUrlObject = new URL(discoveredNormalizedUrl);
            const discoveredPath = discoveredUrlObject.pathname;
            const pathSegments = discoveredPath.split("/").filter(Boolean);

            const isExcluded = excludePaths.some((exPath) => {
              const cleanExPath = exPath.replace(/^\/+|\/+$/g, "").trim();
              return cleanExPath && pathSegments.includes(cleanExPath);
            });

            if (
              discoveredUrlObject.origin === siteOrigin &&
              discoveredPath.startsWith(basePath) &&
              !isExcluded &&
              !collectedData.has(discoveredNormalizedUrl) &&
              !queue.has(discoveredNormalizedUrl) &&
              queue.size + collectedData.size + 1 < limit + 10
            ) {
              queue.add(discoveredNormalizedUrl);
            } else if (isExcluded) {
              // p.log.warn(`Skipping excluded path: ${discoveredNormalizedUrl}`); // Optional: Can be noisy
            }
          } catch (urlError) {
            /* Ignore invalid URLs */
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Navigation timeout")) {
        p.log.error(`Timeout visiting ${currentNormalizedUrl}. Skipping.`);
      } else if (errorMessage.includes("net::ERR_")) {
        p.log.error(
          `Network error visiting ${currentNormalizedUrl}: ${errorMessage}. Skipping.`
        );
      } else {
        p.log.error(`Error crawling ${currentNormalizedUrl}: ${errorMessage}`);
      }
    }
    collectedData.set(currentNormalizedUrl, bodyHTML);
  }

  await browser.close();
  return collectedData;
}

// --- Function Definitions --- (renderTaskList remains)
function renderTaskList(currentState = tasksState) {
  // Default to global if not passed
  const lines = [];
  const sortedPaths = Object.keys(currentState).sort();

  // Use finalGenStats for the header if available (or global if called during run)
  const stats =
    typeof finalGenStats !== "undefined" ? finalGenStats : generationStats;

  for (const relativePath of sortedPaths) {
    const task = currentState[relativePath];
    let statusText = task.status;
    let statusColor = color.gray;
    let icon = " ";

    switch (task.status) {
      case "pending":
        statusText = "Pending";
        icon = ICONS.PENDING;
        break;
      case "skipped":
        statusText = "Skipped";
        statusColor = color.yellow;
        icon = ICONS.SKIPPED;
        break;
      case "generating":
        statusText = `Generating ${task.chunkInfo || ""}`.trim();
        statusColor = color.cyan;
        icon = SPINNER_FRAMES[spinnerFrameIndex]; // Use current spinner frame
        break;
      case "saving":
        statusText = "Saving...";
        statusColor = color.cyan;
        icon = ICONS.SAVING;
        break;
      case "success":
        statusText = "Success";
        statusColor = color.green;
        icon = ICONS.SUCCESS;
        break;
      case "error":
        statusText = "Error";
        statusColor = color.red;
        icon = ICONS.ERROR;
        break;
    }

    const paddedStatus = `[${statusText}]`.padEnd(25);
    let line = ` ${statusColor(icon)} ${statusColor(paddedStatus)} ${color.dim(
      relativePath
    )}`;
    if (task.status === "error" && task.message) {
      line += ` - ${color.red(task.message.slice(0, 70))}`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// --- Main Application Logic ---
async function main() {
  // Add SIGINT Handler near the start
  process.on("SIGINT", () => {
    if (spinnerInterval) clearInterval(spinnerInterval);
    // Attempt to clean up logUpdate - might not be perfect on abrupt exit
    try {
      if (typeof logUpdate.done === "function") {
        logUpdate.done();
      } else if (logUpdate.clear) {
        logUpdate.clear();
      }
    } catch {}
    p.cancel("Operation cancelled by user.");
    process.exit(130); // Standard exit code for Ctrl+C
  });

  console.clear();
  p.intro(color.inverse(" Docs Crawler & Generator 🚀 "));

  // --- 1. Get Options using Clack ---
  const options = await p.group(
    {
      startUrl: () =>
        p.text({
          message: "Enter the starting URL:",
          placeholder: "https://docs.example.com",
          validate: (v) => {
            if (!v) return "URL required";
            try {
              new URL(v);
            } catch {
              return "Invalid URL";
            }
            return undefined;
          },
        }),
      outputDir: () =>
        p.text({ message: "Output directory:", initialValue: "./docs" }),
      projectName: () =>
        p.text({
          message: "Project folder name (optional, uses domain if blank):",
          initialValue: "",
        }),
      limit: () =>
        p.text({
          message: "URL limit (blank for none):",
          initialValue: "",
          validate: (v) =>
            !v || (Number.isInteger(+v) && +v > 0)
              ? undefined
              : "Must be a positive integer",
        }),
      excludePaths: () =>
        p.text({
          message: "Exclude paths? (Comma-separated, e.g., /api,/examples):",
          placeholder: "No exclusions",
          initialValue: "",
        }),
      shouldRestart: () =>
        p.confirm({
          message: "Overwrite existing files?",
          initialValue: false,
        }),
      maxConcurrent: () =>
        p.text({
          message: "Max concurrent requests:",
          initialValue: "2",
          validate: (v) =>
            v && Number.isInteger(+v) && +v > 0
              ? undefined
              : "Must be a positive integer",
        }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  // Parse and store options globally
  const rawExcludePaths = options.excludePaths || "";
  globalOptions = {
    startUrl: options.startUrl,
    outputDir: options.outputDir || "./docs",
    projectName: options.projectName,
    limit: options.limit ? parseInt(options.limit, 10) : Infinity,
    // Parse the excludePaths string into an array, trimming whitespace
    excludePaths: rawExcludePaths
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0),
    shouldRestart: options.shouldRestart,
    maxConcurrent: parseInt(options.maxConcurrent || "10", 10),
  };

  // --- 2. Crawl Website ---
  const s = p.spinner();
  s.start(`Crawling from ${globalOptions.startUrl}...`);
  let dataMap;
  try {
    dataMap = await crawlWebsite(
      globalOptions.startUrl,
      globalOptions.limit,
      globalOptions.excludePaths
    );
    s.stop(`Crawling complete. Found ${dataMap?.size || 0} pages.`);
  } catch (e) {
    s.stop("Crawling failed.");
    p.log.error(`Crawling error: ${e.message}`);
    process.exit(1);
  }

  if (!dataMap || dataMap.size === 0) {
    p.log.warn("Crawl finished but received no data.");
    process.exit(0);
  }

  // --- 3. Prepare Tasks and Directories ---
  p.log.step("Preparing tasks and directories...");
  let domainName = globalOptions.projectName
    ? sanitize(globalOptions.projectName)
    : "";
  if (!domainName) {
    try {
      domainName = new URL(globalOptions.startUrl).hostname.replace(
        /^www\./,
        ""
      );
    } catch {
      domainName = "unknown-site";
    }
  }
  globalPaths.baseDocsDir = path.resolve(
    process.cwd(),
    globalOptions.outputDir
  );
  globalPaths.siteDocsDir = path.join(globalPaths.baseDocsDir, domainName);
  try {
    await fsp.mkdir(globalPaths.siteDocsDir, { recursive: true });
    p.log.info(`Output directory set to: ${globalPaths.siteDocsDir}`);
  } catch (e) {
    p.log.error(`Failed to create directory: ${e.message}`);
    console.error("\n--- Directory Creation Error ---\n", e, "\n---");
    process.exit(1);
  }

  // Initialize tasksState and filter tasks to run
  const tasksToRun = []; // Array of relativePaths for tasks needing processing
  tasksState = {}; // Reset state
  generationStats = { success: 0, error: 0, skipped: 0 }; // Reset stats
  indexEntries.length = 0; // Clear previous index entries

  for (const [url, bodyHTML] of dataMap.entries()) {
    if (!bodyHTML) continue; // Skip pages with no content
    const filename = generateFilenameFromUrl(url);
    const filePath = path.join(globalPaths.siteDocsDir, filename);
    const relativePath = path.relative(globalPaths.baseDocsDir, filePath);

    // Initialize state for ALL potential tasks (for the list view)
    tasksState[relativePath] = {
      url,
      bodyHTML,
      filePath,
      relativePath,
      filename,
      status: "pending",
      message: "",
      chunkInfo: "",
    };

    // Check if task should be skipped
    if (!globalOptions.shouldRestart && fs.existsSync(filePath)) {
      tasksState[relativePath].status = "skipped";
      generationStats.skipped++;
      indexEntries.push({
        title: filename.replace(".md", ""),
        description: "(Skipped - File Exists)",
        path: relativePath,
      });
    } else {
      // Add to the queue of tasks that actually need processing
      tasksToRun.push(relativePath);
    }
  }

  if (tasksToRun.length === 0) {
    p.log.warn(
      "No new documentation pages to generate (all skipped or empty)."
    );
    logUpdate(renderTaskList()); // Show the final list (all skipped/pending)
    logUpdate.done();
    p.outro("✅ Processing complete (no new files generated).");
    process.exit(0);
  }

  p.log.step(
    `Starting generation for ${tasksToRun.length} pages (Concurrency: ${globalOptions.maxConcurrent})...`
  );

  // --- 4. Run Generation Tasks Concurrently using log-update ---
  // Start the spinner animation interval *before* the first render
  if (!spinnerInterval) {
    spinnerInterval = setInterval(() => {
      spinnerFrameIndex = (spinnerFrameIndex + 1) % SPINNER_FRAMES.length;
      // Re-render only if there are active tasks (avoids rendering spinner after completion)
      if (activePromises.size > 0 || taskQueueIndex < tasksToRun.length) {
        logUpdate(renderTaskList());
      }
    }, SPINNER_DELAY);
  }

  logUpdate(renderTaskList()); // Initial render of the full task list

  const activePromises = new Map();
  let taskQueueIndex = 0;
  let processingFinished = false; // Flag to prevent multiple calls to finishProcessing

  const processTask = async (relativePath) => {
    const taskData = tasksState[relativePath];
    taskData.status = "generating";
    taskData.message = "Starting...";
    taskData.chunkInfo = "";
    logUpdate(renderTaskList()); // Update UI: Task is generating

    let finalTitle = taskData.filename.replace(".md", ""); // Default title
    let finalDescription = "";
    let combinedMarkdown = "";

    try {
      const needsChunking = taskData.bodyHTML.length > MAX_CHUNK_SIZE;
      if (needsChunking) {
        // --- Chunking Logic ---
        taskData.chunkInfo = "Chunking...";
        logUpdate(renderTaskList());
        const chunks = [];
        let currentIndex = 0;
        const breakWindow = 500; // How far back to look for sentence breaks
        while (currentIndex < taskData.bodyHTML.length) {
          let end = Math.min(
            currentIndex + MAX_CHUNK_SIZE,
            taskData.bodyHTML.length
          );
          // Try to find a better break point if not at the very end
          if (end < taskData.bodyHTML.length) {
            let bestBreakPoint = -1;
            const searchStart = Math.max(currentIndex, end - breakWindow);
            // Prefer line breaks or sentence endings
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
              const breakPoint = taskData.bodyHTML.lastIndexOf(ending, end - 1);
              if (breakPoint !== -1 && breakPoint >= searchStart) {
                bestBreakPoint = Math.max(
                  bestBreakPoint,
                  breakPoint + ending.length
                );
              }
            }
            // If a good break point was found, use it
            if (bestBreakPoint !== -1 && bestBreakPoint > currentIndex) {
              end = bestBreakPoint;
            }
          }
          chunks.push(taskData.bodyHTML.substring(currentIndex, end));
          currentIndex = end;
        }
        // --- End Chunking Logic ---

        let previousChunkContent = null;
        for (let i = 0; i < chunks.length; i++) {
          taskData.chunkInfo = `Chunk ${i + 1}/${chunks.length}`;
          taskData.status = "generating"; // Keep status as generating
          logUpdate(renderTaskList());

          const currentChunk = chunks[i];
          let promptInputHtml = "";
          // Add overlap context if not the first chunk
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

          // Call AI for the chunk
          const { object: chunkDoc } = await generateObject({
            model: aiClient(modelName),
            schema: docSchema,
            prompt: `${generationPrompt}\\n\\n${promptInputHtml}`,
          });

          // Use title/desc from the first chunk only
          if (i === 0) {
            finalTitle = chunkDoc.title;
            finalDescription = chunkDoc.description;
          }
          // Append markdown content, adding separators
          combinedMarkdown +=
            (i > 0 ? "\\n\\n" : "") + chunkDoc.markdownContent;
          previousChunkContent = currentChunk; // Store for next overlap
        }
      } else {
        // --- Single Chunk Processing ---
        taskData.chunkInfo = "single chunk";
        logUpdate(renderTaskList());
        const { object: doc } = await generateObject({
          model: aiClient(modelName),
          schema: docSchema,
          prompt: `${generationPrompt}\\n\\n${taskData.bodyHTML}`,
        });
        finalTitle = doc.title;
        finalDescription = doc.description;
        combinedMarkdown = doc.markdownContent;
      }

      // --- Saving File ---
      taskData.status = "saving";
      taskData.chunkInfo = ""; // Clear chunk info
      logUpdate(renderTaskList());
      await fsp.writeFile(taskData.filePath, combinedMarkdown);

      // --- Success ---
      taskData.status = "success";
      taskData.message = "";
      indexEntries.push({
        title: finalTitle,
        description: finalDescription,
        path: relativePath,
      });
      generationStats.success++;
    } catch (err) {
      // --- Error Handling ---
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Log full error details separately, not in the updating list
      console.error(`\n--- Task Error: ${relativePath} ---\n`, err, "\n---");
      taskData.status = "error";
      taskData.message = errorMsg; // Store truncated message for UI
      indexEntries.push({
        title: taskData.filename,
        description: `(Failed: ${errorMsg.slice(0, 50)}...)`,
        path: relativePath + ".error",
      });
      generationStats.error++;
    } finally {
      logUpdate(renderTaskList()); // Ensure final status update for this task
    }
  };

  const runNext = () => {
    // Check for completion FIRST - if queue empty and no active tasks, we are done.
    if (taskQueueIndex >= tasksToRun.length && activePromises.size === 0) {
      if (!processingFinished) {
        // Prevent multiple calls
        processingFinished = true;
        // Pass state to finishProcessing
        setTimeout(
          () =>
            finishProcessing(
              tasksState,
              indexEntries,
              generationStats,
              globalOptions,
              globalPaths
            ),
          50
        );
      }
      return; // Stop queuing
    }

    // While there are tasks left in the queue AND we have capacity
    while (
      taskQueueIndex < tasksToRun.length &&
      activePromises.size < globalOptions.maxConcurrent
    ) {
      const relativePath = tasksToRun[taskQueueIndex++];
      const promise = processTask(relativePath).finally(() => {
        activePromises.delete(relativePath); // Remove from active set
        runNext(); // Check for completion and queue next task
      });
      activePromises.set(relativePath, promise); // Add to active set
    }
    // If the queue is now empty, but tasks are still running, we just wait for finally() to call runNext() again.
  };

  // Start the initial batch of tasks
  runNext();
}

// --- Final Processing Steps (called after all tasks complete) ---
async function finishProcessing(
  finalTasksState,
  finalIndexEntries,
  finalGenStats,
  finalOptions,
  finalPaths
) {
  // Clear spinner interval if somehow still running
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }

  logUpdate(renderTaskList(finalTasksState)); // Pass state to render function (needs update)

  if (typeof logUpdate.done === "function") {
    logUpdate.done();
  } else if (logUpdate.clear) {
    logUpdate.clear();
  }

  p.log.step("All generation tasks finished.");

  // --- 5. Generate index.md ---
  if (finalIndexEntries.length > 0) {
    p.log.step("Generating index file...");
    // Ensure paths are available
    if (!finalPaths.siteDocsDir || !finalPaths.baseDocsDir) {
      p.log.error("Cannot generate index: Output paths are not defined.");
    } else {
      const indexFilePath = path.join(finalPaths.siteDocsDir, "index.md");
      const projectName = path.basename(finalPaths.siteDocsDir);

      let indexContent = `# Documentation Index for ${projectName}\n\n`;
      indexContent += `Generated from ${finalOptions.startUrl}\n\n`;
      // Sort entries before writing
      finalIndexEntries.sort((a, b) => a.path.localeCompare(b.path));
      indexContent += finalIndexEntries
        .map(
          (entry) =>
            `- ${entry.title}\n  - Path: ${entry.path}\n  - Description: ${entry.description}`
        )
        .join("\n\n");

      try {
        await fsp.writeFile(indexFilePath, indexContent);
        p.log.success(
          `Index file generated: ${path.relative(
            finalPaths.baseDocsDir,
            indexFilePath
          )}`
        );
      } catch (indexError) {
        p.log.error(`Error writing index file: ${indexError.message}`);
        console.error("\n--- Index Writing Error ---\n", indexError, "\n---");
      }
    }
  } else {
    p.log.info(
      "No index entries were generated (all pages might have been skipped or failed)."
    );
  }

  p.outro(
    color.green(
      `✅ Processing Complete! Success: ${finalGenStats.success}, Failed: ${finalGenStats.error}, Skipped: ${finalGenStats.skipped}`
    )
  );
}

// --- Run Main Application ---
main().catch((err) => {
  // Catch unhandled errors from the main async function
  if (spinnerInterval) clearInterval(spinnerInterval); // Clear interval on error
  p.log.error("An unexpected error occurred during the main process:");
  console.error("\n--- Unhandled Main Error ---\n", err, "\n---");
  p.outro(color.red("❌ Process terminated due to an unexpected error."));
  process.exit(1);
});
