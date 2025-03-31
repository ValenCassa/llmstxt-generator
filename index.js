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
import Yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

// --- Constants ---
const MAX_CHUNK_SIZE = 120000;
const CONTEXT_OVERLAP_SIZE = 5000;

// --- Default Options Constants ---
const DEFAULT_OUTPUT_DIR = "./docs";
const DEFAULT_PROJECT_NAME = ""; // Will default to domain name later
const DEFAULT_EXCLUDE_PATHS = "";
const DEFAULT_SHOULD_RESTART = false;
const DEFAULT_MAX_CONCURRENT = "2";

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

// ===========================================================================
// DocGenerator Class
// ===========================================================================
/**
 * Handles the process of crawling a website, generating Markdown documentation
 * from the content using an AI model, and saving the results.
 */
class DocGenerator {
  /**
   * Initializes the DocGenerator instance, setting up initial state
   * for tasks, index entries, stats, options, paths, and UI elements.
   */
  constructor() {
    // State Variables
    /** @type {Object<string, {url: string, bodyHTML: string, filePath: string, relativePath: string, filename: string, status: 'pending'|'skipped'|'generating'|'saving'|'success'|'error', message: string, chunkInfo: string}>} */
    this.tasksState = {};
    /** @type {Array<{title: string, description: string, path: string}>} */
    this.indexEntries = [];
    /** @type {{success: number, error: number, skipped: number}} */
    this.generationStats = { success: 0, error: 0, skipped: 0 };
    /** @type {{baseUrl?: string, outputDir?: string, projectName?: string, limit?: number, excludePaths?: string[], shouldRegenerate?: boolean, maxConcurrent?: number}} */
    this.options = {};
    /** @type {{baseDocsDir: string | null, siteDocsDir: string | null}} */
    this.paths = { baseDocsDir: null, siteDocsDir: null };

    // UI / Concurrency State
    /** @type {NodeJS.Timeout | null} */
    this.spinnerInterval = null;
    /** @type {number} */
    this.spinnerFrameIndex = 0;
    /** @type {Map<string, Promise<void>>} */
    this.activePromises = new Map();
    /** @type {number} */
    this.taskQueueIndex = 0;
    /** @type {boolean} */
    this.processingFinished = false;
  }

  // --- Helper Methods ---
  /**
   * Normalizes a URL string, resolving relative paths against a base URL
   * and removing the hash fragment. Ensures trailing slashes are removed.
   * @param {string} urlString - The URL string to normalize.
   * @param {string} [baseUrl] - The base URL to resolve against if urlString is relative.
   * @returns {string} The normalized URL string.
   * @private
   */
  #normalizeUrl(urlString, baseUrl) {
    try {
      const url = new URL(urlString, baseUrl);
      url.hash = "";
      let normalized = url.toString();
      if (normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch (error) {
      return urlString;
    }
  }

  /**
   * Sanitizes text for use in filenames by converting to lowercase,
   * replacing whitespace with hyphens, removing invalid characters,
   * and cleaning up hyphens.
   * @param {string} text - The text to sanitize.
   * @returns {string} The sanitized text.
   * @private
   */
  #sanitize(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Generates a safe filename (e.g., "page-name.md") from a URL string.
   * Uses the last path segment, sanitized. Defaults to "index.md" for root paths
   * or a timestamped name if sanitization fails.
   * @param {string} urlString - The URL to generate a filename from.
   * @param {string[]} [basePathSegments=[]] - Path segments of the start URL to potentially remove.
   * @returns {string} The generated markdown filename.
   * @private
   */
  #generateFilenameFromUrl(urlString, basePathSegments = []) {
    try {
      const url = new URL(urlString);
      // Get all path segments, filter out empty ones
      const pathSegments = url.pathname.split("/").filter(Boolean);

      // Check if current path starts with base path segments
      let segmentsToUse = [...pathSegments]; // Clone
      if (
        basePathSegments.length > 0 &&
        segmentsToUse.length >= basePathSegments.length
      ) {
        let match = true;
        for (let i = 0; i < basePathSegments.length; i++) {
          if (segmentsToUse[i] !== basePathSegments[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          // Remove the base segments from the start
          segmentsToUse.splice(0, basePathSegments.length);
        }
      }

      // 3. If removing the prefix left nothing, it's an index under the base
      if (segmentsToUse.length === 0) {
        // CHANGE: Don't return "index.md" for content pages.
        // Use a distinct name like "_index.md" to avoid conflict with the generated index list.
        return "_index.md";
      }

      // 4. Otherwise, join remaining segments
      const joinedSegments = segmentsToUse.join("-");

      // Sanitize the entire joined string
      const sanitized = this.#sanitize(joinedSegments);

      // Return sanitized name or fallback with timestamp
      return sanitized ? `${sanitized}.md` : `page-${Date.now()}.md`;
    } catch (error) {
      console.warn(`Could not parse URL: ${urlString}`, error);
      return `page-${Date.now()}.md`;
    }
  }

  // --- Core Logic Methods ---
  /**
   * Crawls a website starting from a given URL, respecting limits and exclusions.
   * Uses Playwright to fetch and parse pages.
   * @param {string} baseUrl - The initial URL to begin crawling.
   * @param {string[]} [excludePaths=[]] - Array of path segments to exclude.
   * @returns {Promise<Map<string, string|null>>} A Map where keys are normalized URLs and values are the body HTML content (or null on error).
   * @private
   */
  async #crawlWebsite(baseUrl, excludePaths = []) {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    const collectedData = new Map();
    const normalizedBaseUrl = this.#normalizeUrl(baseUrl);
    const queue = new Set();
    const originUrl = new URL(normalizedBaseUrl);
    const siteOrigin = originUrl.origin;
    const basePath =
      originUrl.pathname === "/" ? "/" : originUrl.pathname.replace(/\/?$/, "");
    const startUrlPath = originUrl.pathname;
    const startPathSegments = startUrlPath.split("/").filter(Boolean);
    const isStartExcluded = excludePaths.some((ex) => {
      const clean = ex.replace(/^\/+|\/+$/g, "").trim();
      return clean && startPathSegments.includes(clean);
    });
    if (!isStartExcluded) queue.add(normalizedBaseUrl);
    else p.log.warn(`Skipping base URL ${normalizedBaseUrl} (excluded).`);

    while (queue.size > 0) {
      const currentUrl = queue.values().next().value;
      queue.delete(currentUrl);
      if (collectedData.has(currentUrl)) continue;
      let bodyHTML = null;
      try {
        await page.goto(currentUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        bodyHTML = await page.evaluate(() => document.body?.innerHTML ?? "");
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"), (a) => a.href)
        );
        for (const link of links) {
          const normLink = this.#normalizeUrl(link, currentUrl);
          try {
            const linkUrl = new URL(normLink);
            const linkPath = linkUrl.pathname;
            const segments = linkPath.split("/").filter(Boolean);
            const excluded = excludePaths.some((ex) => {
              const clean = ex.replace(/^\/+|\/+$/g, "").trim();
              return clean && segments.includes(clean);
            });
            if (
              linkUrl.origin === siteOrigin &&
              linkPath.startsWith(basePath) &&
              !excluded &&
              !collectedData.has(normLink) &&
              !queue.has(normLink) &&
              queue.size + collectedData.size + 1 < collectedData.size + 20
            ) {
              queue.add(normLink);
            }
          } catch {
            /* ignore invalid links */
          }
        }
      } catch (e) {
        const msg = e.message;
        if (msg.includes("timeout")) p.log.error(`Timeout: ${currentUrl}`);
        else if (msg.includes("net::ERR"))
          p.log.error(`Network Error: ${currentUrl}`);
        else p.log.error(`Crawl Error: ${currentUrl}: ${msg}`);
      }
      collectedData.set(currentUrl, bodyHTML);
    }
    await browser.close();
    return collectedData;
  }

  /**
   * Renders the current state of all tasks into a string suitable for display.
   * Includes status icons, colors, padding, and error messages.
   * Uses the current spinner frame for 'generating' tasks.
   * @returns {string} A multi-line string representing the task list.
   * @private
   */
  #renderFullTaskList() {
    const lines = [];
    const sortedPaths = Object.keys(this.tasksState).sort();
    for (const relativePath of sortedPaths) {
      const task = this.tasksState[relativePath];
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
          icon = SPINNER_FRAMES[this.spinnerFrameIndex];
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
      const padded = `[${statusText}]`.padEnd(25);
      let line = `   ${statusColor(icon)} ${statusColor(padded)} ${color.dim(
        relativePath
      )}`;
      if (task.status === "error" && task.message)
        line += ` - ${color.red(task.message.slice(0, 70))}`;
      lines.push(line);
    }
    return lines.join("\n");
  }

  /**
   * Renders a concise progress update for log-update, showing active tasks and counts.
   * @returns {string} A multi-line string with summary and active tasks.
   * @private
   */
  #renderProgressUpdate() {
    let generatingCount = 0;
    let savingCount = 0;
    let pendingCount = 0;
    let successCount = this.generationStats.success; // Start with existing/already completed
    let errorCount = this.generationStats.error;

    const activeTaskLines = [];
    const sortedPaths = Object.keys(this.tasksState).sort();

    for (const relativePath of sortedPaths) {
      const task = this.tasksState[relativePath];
      let line = null;

      switch (task.status) {
        case "generating":
          generatingCount++;
          // Format line for active task
          line = `   ${color.cyan(
            SPINNER_FRAMES[this.spinnerFrameIndex]
          )} ${color.cyan(
            `[Generating ${task.chunkInfo || ""}]`.padEnd(25)
          )} ${color.dim(relativePath)}`;
          break;
        case "saving":
          savingCount++;
          // Format line for active task
          line = `   ${color.cyan(ICONS.SAVING)} ${color.cyan(
            "[Saving...]".padEnd(25)
          )} ${color.dim(relativePath)}`;
          break;
        case "pending":
          pendingCount++;
          break;
        // We use generationStats for final success/error counts, but need to account for non-finished ones if needed.
        // For now, assume generationStats covers completed tasks correctly.
      }
      if (line) activeTaskLines.push(line);
    }

    // Adjust counts if generationStats is not live (it seems to be updated *after* task finishes)
    // Recalculate success/error by iterating if needed for live view - simpler for now:
    successCount = this.generationStats.success;
    errorCount = this.generationStats.error;

    // Build summary string with indentation and colors
    const summary = `   ${color.cyan(
      `Active: ${generatingCount + savingCount}`
    )} ${color.dim("|")} ${color.gray(`Pending: ${pendingCount}`)} ${color.dim(
      "|"
    )} ${color.green(`Success: ${successCount}`)} ${color.dim("|")} ${color.red(
      `Error: ${errorCount}`
    )}`;

    // Combine summary and active tasks
    return `${summary}\n${activeTaskLines.join("\n")}`;
  }

  /**
   * Processes a single task: generates markdown from HTML content using AI,
   * handles chunking for large content, saves the markdown to a file,
   * and updates task status and stats. Updates UI via logUpdate.
   * @param {string} relativePath - The relative path identifying the task in `tasksState`.
   * @returns {Promise<void>}
   * @private
   */
  #processTask = async (relativePath) => {
    const taskData = this.tasksState[relativePath];
    taskData.status = "generating";
    taskData.message = "Starting...";
    taskData.chunkInfo = "";
    logUpdate(`\n${this.#renderProgressUpdate()}\n`);
    let finalTitle = taskData.filename.replace(".md", "");
    let finalDescription = "";
    let combinedMarkdown = "";
    try {
      const needsChunking = taskData.bodyHTML.length > MAX_CHUNK_SIZE;
      if (needsChunking) {
        taskData.chunkInfo = "Chunking...";
        logUpdate(`\n${this.#renderProgressUpdate()}\n`);
        const chunks = [];
        let currentIndex = 0;
        const breakWindow = 500;
        while (currentIndex < taskData.bodyHTML.length) {
          let end = Math.min(
            currentIndex + MAX_CHUNK_SIZE,
            taskData.bodyHTML.length
          );
          if (end < taskData.bodyHTML.length) {
            let bestBreak = -1;
            const searchStart = Math.max(currentIndex, end - breakWindow);
            const endings = [". ", ".\n", "! ", "!\n", "? ", "?\n", "\n"];
            for (const ending of endings) {
              const pt = taskData.bodyHTML.lastIndexOf(ending, end - 1);
              if (pt !== -1 && pt >= searchStart)
                bestBreak = Math.max(bestBreak, pt + ending.length);
            }
            if (bestBreak !== -1 && bestBreak > currentIndex) end = bestBreak;
          }
          chunks.push(taskData.bodyHTML.substring(currentIndex, end));
          currentIndex = end;
        }
        let prevContent = null;
        for (let i = 0; i < chunks.length; i++) {
          taskData.chunkInfo = `Chunk ${i + 1}/${chunks.length}`;
          logUpdate(`\n${this.#renderProgressUpdate()}\n`);
          let inputHtml = chunks[i];
          if (i > 0 && prevContent) {
            const overlap = Math.max(
              0,
              prevContent.length - CONTEXT_OVERLAP_SIZE
            );
            inputHtml = `${prevContent.substring(
              overlap
            )}\n\n--- Overlap End / Current Chunk Start ---\n\n${chunks[i]}`;
          }
          const { object: chunkDoc } = await generateObject({
            model: aiClient(modelName),
            schema: docSchema,
            prompt: `${generationPrompt}\n\n${inputHtml}`,
          });
          if (i === 0) {
            finalTitle = chunkDoc.title;
            finalDescription = chunkDoc.description;
          }
          combinedMarkdown += (i > 0 ? "\n\n" : "") + chunkDoc.markdownContent;
          prevContent = chunks[i];
        }
      } else {
        taskData.chunkInfo = "single chunk";
        logUpdate(`\n${this.#renderProgressUpdate()}\n`);
        const { object: doc } = await generateObject({
          model: aiClient(modelName),
          schema: docSchema,
          prompt: `${generationPrompt}\n\n${taskData.bodyHTML}`,
        });
        finalTitle = doc.title;
        finalDescription = doc.description;
        combinedMarkdown = doc.markdownContent;
      }
      taskData.status = "saving";
      taskData.chunkInfo = "";
      logUpdate(`\n${this.#renderProgressUpdate()}\n`);
      await fsp.writeFile(taskData.filePath, combinedMarkdown);
      taskData.status = "success";
      taskData.message = "";
      // Store workspace-relative path for the index
      const workspaceRelativePath = path.relative(
        process.cwd(),
        taskData.filePath
      );
      this.indexEntries.push({
        title: finalTitle,
        description: finalDescription,
        path: workspaceRelativePath, // Use workspace-relative path
      });
      this.generationStats.success++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`\n--- Task Error: ${relativePath} ---\n`, err, "\n---");
      taskData.status = "error";
      taskData.message = errorMsg;
      // Store workspace-relative path even for errors, if possible
      const workspaceRelativePathOnError = path.relative(
        process.cwd(),
        taskData.filePath
      );
      this.indexEntries.push({
        title: taskData.filename,
        description: `(Failed: ${errorMsg.slice(0, 50)}...)`,
        path: workspaceRelativePathOnError + ".error", // Use workspace-relative path
      });
      this.generationStats.error++;
    } finally {
      logUpdate(`\n${this.#renderProgressUpdate()}\n`);
    }
  };

  /**
   * Runs the next available task from the queue if concurrency limits allow.
   * If the queue is finished and no tasks are active, calls #finishProcessing.
   * This method is called recursively within promise chains to ensure continuous processing.
   * @private
   */
  #runNext = () => {
    if (
      this.taskQueueIndex >= this.tasksToRun.length &&
      this.activePromises.size === 0
    ) {
      if (!this.processingFinished) {
        this.processingFinished = true;
        setTimeout(this.#finishProcessing, 50);
      }
      return;
    }
    while (
      this.taskQueueIndex < this.tasksToRun.length &&
      this.activePromises.size < this.options.maxConcurrent
    ) {
      const relativePath = this.tasksToRun[this.taskQueueIndex++];
      const promise = this.#processTask(relativePath).finally(() => {
        this.activePromises.delete(relativePath);
        this.#runNext(); // Try to run the next one
      });
      this.activePromises.set(relativePath, promise);
    }
  };

  /**
   * Generates the Markdown content for the index.md file based on the
   * current state of indexEntries and tasksState. Includes header,
   * placeholders for existing files, sorting, and formatting.
   * @returns {string} The complete Markdown content for the index file.
   * @private
   */
  #generateIndexContent() {
    if (!this.paths.siteDocsDir || !this.options.baseUrl) {
      p.log.warn(
        "Cannot generate index content: Missing site directory or base URL."
      );
      return ""; // Return empty string or handle error appropriately
    }
    const projectName = path.basename(this.paths.siteDocsDir);
    let content = `# Documentation Index for ${projectName}\n\nGenerated from ${this.options.baseUrl}\n\n`;

    // Add entries for existing files that were marked as success but didn't go through #processTask
    // Ensure we don't add duplicates if an existing file was somehow processed
    const processedPaths = new Set(this.indexEntries.map((e) => e.path));
    const entriesToAdd = [...this.indexEntries]; // Start with AI-generated/error entries

    for (const relativePath in this.tasksState) {
      const task = this.tasksState[relativePath];
      // Add entries for files marked 'success' initially (existing files)
      // or tasks that completed successfully but might not have added their entry yet if interrupted.
      // Calculate workspace-relative path here to use for checks
      const workspaceRelativePath = path.relative(process.cwd(), task.filePath);
      if (
        task.status === "success" &&
        !processedPaths.has(workspaceRelativePath)
      ) {
        // Avoid adding duplicates if entry already exists for some reason
        // Compare workspace-relative paths here too
        if (!entriesToAdd.some((e) => e.path === workspaceRelativePath)) {
          entriesToAdd.push({
            // Use filename from task data, might be more reliable than regenerating
            title: task.filename.replace(".md", ""),
            description: "(Existing File)", // Mark clearly
            path: workspaceRelativePath, // Use workspace-relative path
          });
        }
      }
    }

    // Sort all collected entries (original + existing placeholders)
    entriesToAdd.sort((a, b) => a.path.localeCompare(b.path));

    // Format the sorted entries
    content += entriesToAdd
      .map(
        (e) =>
          `- ${e.title}\n  - Path to file: ${e.path}\n  - Description: ${e.description}`
      )
      .join("\n\n");

    return content;
  }

  /**
   * Finalizes the generation process after all tasks are complete.
   * Stops the spinner, performs a final render, generates the index.md file,
   * and logs the final statistics.
   * @returns {Promise<void>}
   * @private
   */
  #finishProcessing = async () => {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    logUpdate(`\n${this.#renderProgressUpdate()}\n`);
    if (typeof logUpdate.done === "function") logUpdate.done();
    else if (logUpdate.clear) logUpdate.clear();

    // Print the full final list here
    console.log(this.#renderFullTaskList());

    p.log.step("All generation tasks finished.");
    if (this.indexEntries.length > 0) {
      p.log.step("Generating index file...");
      if (!this.paths.siteDocsDir || !this.paths.baseDocsDir)
        p.log.error("Cannot generate index: Output paths missing.");
      else {
        const indexFilePath = path.join(this.paths.siteDocsDir, "index.md");

        if (this.options.shouldRegenerate) {
          // --- Regenerate Mode: Overwrite the entire index ---
          const indexContent = this.#generateIndexContent(); // Generate full index content
          if (indexContent) {
            try {
              await fsp.writeFile(indexFilePath, indexContent); // Overwrite file
              p.log.success(
                `Index file regenerated: ${path.relative(
                  this.paths.baseDocsDir,
                  indexFilePath
                )}`
              );
            } catch (e) {
              p.log.error(`Index overwrite error: ${e.message}`);
              console.error("\n--- Index Overwrite Error ---\n", e, "\n---");
            }
          } else {
            p.log.warn(
              "Index content generation failed or returned empty (Regenerate Mode)."
            );
          }
        } else {
          // --- Append Mode: Add only new entries to the existing index ---
          if (this.indexEntries.length > 0) {
            // Format only the new entries generated in this run
            const newEntriesContent = this.indexEntries
              .map(
                (e) =>
                  `- ${e.title}\n  - Path to file: ${e.path}\n  - Description: ${e.description}`
              )
              .join("\n\n");

            try {
              // Check if file exists and needs a preceding newline
              let fileExists = false;
              try {
                await fsp.access(indexFilePath);
                fileExists = true;
              } catch {}

              const contentToAppend =
                (fileExists ? "\n\n" : "") + newEntriesContent;

              await fsp.appendFile(indexFilePath, contentToAppend); // Append new entries
              p.log.success(
                `${
                  this.indexEntries.length
                } new entries appended to index: ${path.relative(
                  this.paths.baseDocsDir,
                  indexFilePath
                )}`
              );
            } catch (e) {
              p.log.error(`Index append error: ${e.message}`);
              console.error("\n--- Index Append Error ---\n", e, "\n---");
            }
          } else {
            p.log.info("No new entries to append to index.");
          }
        }
      }
    } else p.log.info("No index entries generated.");
    p.outro(
      color.green(
        `✅ Processing Complete! Success: ${this.generationStats.success}, Failed: ${this.generationStats.error}, Skipped: ${this.generationStats.skipped}`
      )
    );
  };

  /**
   * The main public method to orchestrate the entire documentation generation process.
   * Handles SIGINT, clears console, prompts user for options, initiates crawling,
   * prepares tasks, starts concurrent processing, and handles final output.
   * Catches potential unhandled errors during the run.
   * @returns {Promise<void>}
   */
  run = async () => {
    process.on("SIGINT", () => {
      if (this.spinnerInterval) clearInterval(this.spinnerInterval);
      try {
        if (typeof logUpdate.done === "function") logUpdate.done();
        else if (logUpdate.clear) logUpdate.clear();
      } catch {}

      // Attempt to write the current index state before exiting
      if (generator && generator.paths?.siteDocsDir) {
        try {
          const indexFilePath = path.join(
            generator.paths.siteDocsDir,
            "index.md"
          );

          if (generator.options.shouldRegenerate) {
            // --- Regenerate Mode on Exit: Overwrite ---
            const indexContent = generator.#generateIndexContent();
            if (indexContent) {
              p.log.warn(
                `Process interrupted. Regenerating index at ${indexFilePath}...`
              );
              fs.writeFileSync(indexFilePath, indexContent); // Overwrite
              p.log.success("Index regenerated.");
            } else {
              p.log.warn(
                "Could not generate index content on exit (Regenerate Mode)."
              );
            }
          } else {
            // --- Append Mode on Exit: Append new entries ---
            if (generator.indexEntries.length > 0) {
              const newEntriesContent = generator.indexEntries
                .map(
                  (e) =>
                    `- ${e.title}\n  - Path to file: ${e.path}\n  - Description: ${e.description}`
                )
                .join("\n\n");

              p.log.warn(
                `Process interrupted. Appending ${generator.indexEntries.length} new entries to ${indexFilePath}...`
              );
              // Check if file exists and needs a preceding newline
              let fileExists = false;
              try {
                fs.accessSync(indexFilePath); // Use sync version
                fileExists = true;
              } catch {}
              const contentToAppend =
                (fileExists ? "\n\n" : "") + newEntriesContent;

              fs.appendFileSync(indexFilePath, contentToAppend); // Append using sync
              p.log.success("New entries appended.");
            } else {
              p.log.info("Process interrupted. No new entries to append.");
            }
          }
        } catch (e) {
          p.log.error(`Failed to write index on exit: ${e.message}`);
        }
      }

      // Print full list on exit
      if (generator) {
        // Check if generator exists
        console.log(generator.#renderFullTaskList());
        console.log("-----------------------------------");
      }
      p.cancel("Operation cancelled by user.");
      process.exit(130);
    });

    console.clear();
    p.intro(color.inverse(" Docs Crawler & Generator 🚀 "));

    // --- Configure and Parse CLI Arguments with Yargs ---
    const yargs = Yargs(hideBin(process.argv));
    const argv = await yargs
      .option("b", {
        alias: "baseUrl",
        describe: "Base URL to crawl",
        type: "string",
        demandOption: false,
      })
      .option("o", {
        alias: "outputDir",
        describe: "Output directory",
        type: "string",
        default: DEFAULT_OUTPUT_DIR,
      })
      .option("p", {
        alias: "projectName",
        describe: "Project folder name (defaults to domain)",
        type: "string",
        default: DEFAULT_PROJECT_NAME,
      })
      .option("e", {
        alias: "excludePaths",
        describe: "Comma-separated paths to exclude (e.g., /api,/foo)",
        type: "string",
        default: DEFAULT_EXCLUDE_PATHS,
      })
      .option("r", {
        alias: "shouldRegenerate",
        describe: "Regenerate existing files?",
        type: "boolean",
        default: DEFAULT_SHOULD_RESTART,
      })
      .option("c", {
        alias: "maxConcurrent",
        describe: "Max concurrent AI requests",
        type: "string",
        default: DEFAULT_MAX_CONCURRENT,
      })
      .help()
      .alias("help", "h")
      .parseAsync(); // Use parseAsync for potential async operations

    // --- 1. Get Options --- (Conditionally)
    let opts = {};
    let skipPrompts = false;

    if (argv.baseUrl) {
      try {
        new URL(argv.baseUrl);
        p.log.info("Base URL provided via CLI, skipping prompts...");
        opts = { ...argv }; // Use the parsed argv (includes defaults)
        skipPrompts = true;
      } catch {
        p.log.warn(
          "Invalid Base URL provided via CLI. Falling back to interactive prompts."
        );
      }
    }

    if (!skipPrompts) {
      // --- Interactive Prompts ---
      opts = await p.group(
        {
          baseUrl: () =>
            p.text({
              message: "Enter the base URL:",
              placeholder: "https://docs.example.com",
              validate: (v) => {
                if (!v) return "Required";
                try {
                  new URL(v);
                } catch {
                  return "Invalid URL";
                }
              },
            }),
          outputDir: () =>
            p.text({
              message: "Output directory:",
              initialValue: DEFAULT_OUTPUT_DIR,
            }),
          projectName: () =>
            p.text({
              message: "Project folder name (inside output directory):",
              placeholder: "(Leave blank to use domain name)",
              initialValue: DEFAULT_PROJECT_NAME,
            }),
          excludePaths: () =>
            p.text({
              message:
                "Exclude paths? (Comma-separated, e.g., /api,/examples):",
              placeholder: "No exclusions",
              initialValue: DEFAULT_EXCLUDE_PATHS,
            }),
          shouldRegenerate: () =>
            p.confirm({
              message: "Regenerate existing files?",
              initialValue: DEFAULT_SHOULD_RESTART,
            }),
          maxConcurrent: () =>
            p.text({
              message: "Max concurrent requests:",
              initialValue: DEFAULT_MAX_CONCURRENT,
              validate: (v) =>
                v && Number.isInteger(+v) && +v > 0
                  ? undefined
                  : "Positive integer required",
            }),
        },
        {
          onCancel: () => {
            p.cancel("Operation cancelled.");
            process.exit(0);
          },
        }
      );
    }

    // --- Assign Options to Class Property ---
    this.options = {
      baseUrl: opts.baseUrl,
      outputDir: opts.outputDir, // Defaults applied by yargs/prompts
      projectName: opts.projectName, // Defaults applied by yargs/prompts
      excludePaths: (opts.excludePaths || "") // Ensure split works even if empty
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      shouldRegenerate: opts.shouldRegenerate,
      maxConcurrent: parseInt(opts.maxConcurrent, 10), // ParseInt needed
    };

    // Validate maxConcurrent after potential parsing
    if (
      !Number.isInteger(this.options.maxConcurrent) ||
      this.options.maxConcurrent <= 0
    ) {
      p.log.error(
        `Invalid Max Concurrent value: ${opts.maxConcurrent}. Must be a positive integer.`
      );
      process.exit(1);
    }

    // --- 2. Crawl ---
    const s = p.spinner();
    s.start(`Crawling from ${this.options.baseUrl}...`);
    let dataMap;
    try {
      dataMap = await this.#crawlWebsite(
        this.options.baseUrl,
        this.options.excludePaths
      );
      s.stop(`Crawling complete. Found ${dataMap?.size || 0} pages.`);

      // Log the found paths
      if (dataMap && dataMap.size > 0) {
        const pathsList = Array.from(dataMap.keys()).join("\n");
        p.note(`Found paths:\n${pathsList}`, "Crawled URLs");
      }
    } catch (e) {
      s.stop("Crawling failed.");
      p.log.error(`Crawling error: ${e.message}`);
      process.exit(1);
    }
    if (!dataMap || dataMap.size === 0) {
      p.log.warn("Crawl finished - no data.");
      process.exit(0);
    }

    // --- 3. Prepare Tasks & Dirs ---
    p.log.step("Preparing tasks and directories...");
    let domain = this.options.projectName
      ? this.#sanitize(this.options.projectName)
      : "";
    if (!domain) {
      try {
        domain = new URL(this.options.baseUrl).hostname.replace(/^www\./, "");
      } catch {
        domain = "unknown-site";
      }
    }
    this.paths.baseDocsDir = path.resolve(
      process.cwd(),
      this.options.outputDir
    );
    this.paths.siteDocsDir = path.join(this.paths.baseDocsDir, domain);
    try {
      await fsp.mkdir(this.paths.siteDocsDir, { recursive: true });
      p.log.info(`Outputting to: ${this.paths.siteDocsDir}`);
    } catch (e) {
      p.log.error(`Directory error: ${e.message}`);
      console.error("\n---", e, "\n---");
      process.exit(1);
    }

    // Calculate base path segments from startUrl ONCE
    let baseUrlPathSegments = [];
    try {
      baseUrlPathSegments = new URL(this.options.baseUrl).pathname
        .split("/")
        .filter(Boolean);
    } catch {
      p.log.warn("Could not parse startUrl to determine base path segments.");
    }

    this.tasksToRun = []; // Store tasks to run here
    this.tasksState = {};
    this.generationStats = { success: 0, error: 0, skipped: 0 };
    this.indexEntries.length = 0;
    for (const [url, bodyHTML] of dataMap.entries()) {
      if (!bodyHTML) continue;
      // Pass base segments to filename generator
      const filename = this.#generateFilenameFromUrl(url, baseUrlPathSegments);
      const filePath = path.join(this.paths.siteDocsDir, filename);
      const relativePath = path.relative(this.paths.baseDocsDir, filePath);

      this.tasksState[relativePath] = {
        url,
        bodyHTML,
        filePath,
        relativePath,
        filename,
        status: "pending",
        message: "",
        chunkInfo: "",
      };
      if (!this.options.shouldRegenerate && fs.existsSync(filePath)) {
        this.tasksState[relativePath].status = "success";
        this.generationStats.success++;
      } else {
        this.tasksToRun.push(relativePath);
      }
    }

    if (this.tasksToRun.length === 0 && this.generationStats.success > 0) {
      p.log.warn("All required files already exist.");
      logUpdate(`\n${this.#renderProgressUpdate()}\n`);
      this.#finishProcessing();
      return;
    } else if (this.tasksToRun.length === 0) {
      p.log.warn("No new pages to generate.");
      logUpdate(`\n${this.#renderProgressUpdate()}\n`);
      if (typeof logUpdate.done === "function") logUpdate.done();
      else if (logUpdate.clear) logUpdate.clear();
      p.outro("✅ Done (no new files generated).");
      process.exit(0);
    }
    p.log.step(
      `Starting generation for ${this.tasksToRun.length} pages (Concurrency: ${this.options.maxConcurrent})...`
    );

    // --- 4. Run Concurrently --- (Start spinner and runNext)
    if (!this.spinnerInterval) {
      this.spinnerInterval = setInterval(() => {
        this.spinnerFrameIndex =
          (this.spinnerFrameIndex + 1) % SPINNER_FRAMES.length;
        if (
          this.activePromises.size > 0 ||
          this.taskQueueIndex < this.tasksToRun.length
        )
          logUpdate(`\n${this.#renderProgressUpdate()}\n`);
      }, SPINNER_DELAY);
    }
    logUpdate(`\n${this.#renderProgressUpdate()}\n`);
    this.activePromises.clear();
    this.taskQueueIndex = 0;
    this.processingFinished = false;
    this.#runNext(); // Start the process
  };
}

// --- Run Main Application ---
/**
 * Creates an instance of the DocGenerator and executes its run method.
 * Includes top-level error catching for unexpected failures.
 */
const generator = new DocGenerator();
generator.run().catch((err) => {
  // Catch unhandled errors from the main run method
  // SIGINT handler should catch Ctrl+C, this is for other unexpected errors
  if (generator.spinnerInterval) clearInterval(generator.spinnerInterval); // Access interval via instance
  try {
    if (typeof logUpdate.done === "function") logUpdate.done();
    else if (logUpdate.clear) logUpdate.clear();
  } catch {}
  p.log.error("An unexpected error occurred during the main process:");
  console.error("\n--- Unhandled Main Error ---\n", err, "\n---");
  p.outro(color.red("❌ Process terminated due to an unexpected error."));
  process.exit(1);
});
