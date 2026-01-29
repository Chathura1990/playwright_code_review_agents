#!/usr/bin/env node

/**
 * Playwright Code Review Agent
 *
 * Usage:
 *   npx playwright-review-agent [file-or-directory]
 *   npx playwright-review-agent --help
 *
 * Examples:
 *   npx playwright-review-agent tests/
 *   npx playwright-review-agent login.spec.ts
 *   npx playwright-review-agent --all path/to/review
 *
 * Options:
 *   --help, -h     Show help message
 *   --all          Review all test files including .js
 *   --version      Show version
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class PlaywrightCodeReviewer {
  constructor() {
    this.issues = [];
    this.positiveAspects = [];
    this.currentFile = "";
  }

  /**
   * Main review method
   */
  async review(targetPath = ".", options = {}) {
    const files = this.getTestFiles(targetPath, options.all);

    if (files.length === 0) {
      console.log("🔍 No Playwright test files found.");
      return;
    }

    console.log(`🔍 Reviewing ${files.length} Playwright test files...\n`);

    for (const file of files) {
      await this.reviewFile(file);
    }

    this.printSummary();
  }

  /**
   * Get all test files to review
   */
  getTestFiles(targetPath, all = false) {
    const isDirectory = fs.statSync(targetPath).isDirectory();
    const pattern = all ? "**/*.{spec,test}.{ts,js}" : "**/*.{spec,test}.ts";

    if (isDirectory) {
      try {
        const files = execSync(`find ${targetPath} -name "*.spec.ts" -o -name "*.test.ts"`, { encoding: "utf8" });
        return files
          .trim()
          .split("\n")
          .filter((f) => f);
      } catch (error) {
        return [];
      }
    } else {
      return [targetPath];
    }
  }

  /**
   * Review a single file
   */
  async reviewFile(filePath) {
    this.currentFile = filePath;
    this.issues = [];
    this.positiveAspects = [];

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      console.log(`## File: ${filePath}`);
      console.log("---");

      // Check each line for issues
      lines.forEach((line, index) => {
        this.checkLine(line, index + 1, content);
      });

      // Check test file architecture rules
      this.checkTestFileArchitecture(filePath, lines);

      // Overall file checks
      this.checkFileStructure(content);

      this.printFileResults();
    } catch (error) {
      console.log(`❌ Error reading file: ${error.message}`);
    }
  }

  /**
   * Check individual line for issues
   */
  checkLine(line, lineNumber, content) {
    // Skip commented lines
    if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("/*") || line.trim().startsWith("*")) {
      return;
    }

    // Check for bad locators
    if (line.includes("page.locator(") || line.includes("$('")) {
      const match = line.match(/page\.locator\(['"`]([^'"`]+)['"`]\)/);
      if (match) {
        const selector = match[1];
        if (selector.startsWith(".") || selector.startsWith("#") || selector.includes(" > ")) {
          this.addIssue("HIGH", `Bad CSS selector: "${selector}"`, lineNumber, `Use page.getByRole() or page.getByTestId() instead`);
        }
      }
    }

    // Check for waitForTimeout
    if (line.includes("waitForTimeout(")) {
      this.addIssue("HIGH", "Using waitForTimeout - makes tests flaky", lineNumber, "Use web-first assertions like expect(locator).toBeVisible()");
    }

    // Check for bad visibility assertions
    if (line.includes("expect(await ") && line.includes(".isVisible()")) {
      this.addIssue("MEDIUM", "Using isVisible() in assertion", lineNumber, "Use expect(locator).toBeVisible() for web-first assertion");
    }

    // Check for missing await on actions
    const actions = ["click(", "fill(", "press(", "type(", "hover(", "focus("];
    actions.forEach((action) => {
      if (line.includes(action) && !line.trim().startsWith("await ") && !line.includes("await ")) {
        this.addIssue("HIGH", `Missing await on ${action.replace("(", "")} action`, lineNumber, "Add await before the action");
      }
    });

    // Check for any types
    if (line.includes(": any") || line.includes("<any>")) {
      this.addIssue("MEDIUM", "Using any type", lineNumber, "Use proper Playwright types like Locator, Page, etc.");
    }

    // Check for XPath (but not in comments or URLs)
    const hasXPathFunction = line.includes("xpath(");
    const hasXPathSelector =
      line.includes("//") &&
      !line.includes("http") &&
      !line.includes("https") &&
      // Skip all comment patterns - if it looks like a comment, don't flag as XPath
      !line.trim().startsWith("//") && // Lines starting with //
      !line.includes("// ") && // Inline comments with space after //
      !line.match(/\w+\/\/\w+/) && // Code followed by //comment
      !line.match(/\w+\s*\/\/\s*\w+/) && // Code with space then comment
      !line.match(/\/\/\s*[a-zA-Z]/) && // // followed by letters (likely comment)
      !line.match(/\/\/\d/) && // // followed by numbers (like //7166)
      !line.match(/\/\/[a-zA-Z0-9_-]+\(/); // // followed by function calls

    if (hasXPathFunction || hasXPathSelector) {
      this.addIssue("MEDIUM", "Using XPath selector", lineNumber, "Prefer getByRole() or getByTestId() for better stability");
    }

    // Check for good practices (only in non-test files)
    const absolutePath = path.resolve(this.currentFile);
    const isTestFile = (this.currentFile.includes("/tests/") || absolutePath.includes("/tests/")) && this.currentFile.endsWith(".spec.ts");

    if (!isTestFile) {
      if (line.includes("page.getByRole(")) {
        this.addPositive("Using getByRole() for accessible locators", lineNumber);
      }
      // Don't show expect.soft as positive in test files - it should be in validators
      if (line.includes("expect.soft(")) {
        this.addPositive("Using soft assertions for multiple checks", lineNumber);
      }
      if (line.includes("readonly ")) {
        this.addPositive("Using readonly properties for locators", lineNumber);
      }
    }
    if (line.includes("expect.soft(")) {
      this.addPositive("Using soft assertions for multiple checks", lineNumber);
    }
    if (line.includes("readonly ")) {
      this.addPositive("Using readonly properties for locators", lineNumber);
    }
  }

  /**
   * Check overall file structure
   */
  checkFileStructure(content) {
    // Check if it's a Page Object file
    if (this.currentFile.includes("page") || this.currentFile.includes("Page")) {
      if (content.includes("expect(")) {
        this.addIssue("MEDIUM", "Page Object contains assertions", 0, "Move assertions to test files, keep POM for actions only");
      }
    }

    // Check for test isolation
    const testCount = (content.match(/test\(/g) || []).length;
    const beforeEachCount = (content.match(/beforeEach\(/g) || []).length;

    if (testCount > 1 && beforeEachCount === 0 && !content.includes("test.use")) {
      this.addPositive("Tests appear to be independent (no shared state)", 0);
    }
  }

  /**
   * Add an issue to the list
   */
  addIssue(severity, description, line, suggestion) {
    this.issues.push({ severity, description, line, suggestion });
  }

  /**
   * Check test file architecture rules
   */
  checkTestFileArchitecture(filePath, lines) {
    // Check if file is a test file in /tests directory and ends with .spec.ts
    const absolutePath = path.resolve(filePath);
    const isTestFile = (filePath.includes("/tests/") || absolutePath.includes("/tests/")) && filePath.endsWith(".spec.ts");

    if (isTestFile) {
      // Check for locators in test files
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        // Skip commented lines
        if (trimmedLine.startsWith("//") || trimmedLine.startsWith("#") || trimmedLine.startsWith("/*") || trimmedLine.startsWith("*")) {
          return;
        }

        // Check for locator patterns (catch ALL locators in test files)
        const locatorPatterns = [
          /page\.locator\(/,
          /page\$\(/,
          /locator\(/,
          /xpath\(/,
          /page\.getByRole\(/,
          /page\.getByText\(/,
          /page\.getByLabel\(/,
          /page\.getByPlaceholder\(/,
          /page\.getByTestId\(/,
          /page\.getByAltText\(/,
          /page\.getByTitle\(/,
        ];

        // Only add one issue per line even if multiple patterns match
        let foundLocator = false;
        locatorPatterns.forEach((pattern) => {
          if (pattern.test(trimmedLine) && !foundLocator) {
            this.addIssue(
              "HIGH",
              "Locator found in test file",
              lineNumber,
              "Move locators to Page Object layer in /pages directory. Test files should only call Page Object methods.",
            );
            foundLocator = true;
          }
        });

        // Check for action patterns (catch ALL actions in test files)
        const actionPatterns = [
          /\.click\(/,
          /\.fill\(/,
          /\.type\(/,
          /\.press\(/,
          /\.hover\(/,
          /\.focus\(/,
          /\.blur\(/,
          /\.check\(/,
          /\.uncheck\(/,
          /\.selectOption\(/,
          /\.clear\(/,
          /\.dragAndDrop\(/,
          /\.doubleClick\(/,
          /\.rightClick\(/,
          /\.tap\(/,
          /\.swipe\(/,
          /\.scroll\(/,
          /\.waitFor\(/,
          /\.waitForSelector\(/,
          /\.waitForFunction\(/,
          /\.goto\(/,
          /\.reload\(/,
          /\.goBack\(/,
          /\.goForward\(/,
          /\.screenshot\(/,
          /\.pdf\(/,
        ];

        let foundAction = false;
        actionPatterns.forEach((pattern) => {
          if (pattern.test(trimmedLine) && !foundAction) {
            this.addIssue(
              "HIGH",
              "Action found in test file",
              lineNumber,
              "Move actions to Page Object layer in /pages directory. Test files should only call reusable Page Object methods.",
            );
            foundAction = true;
          }
        });

        // Check for expect assertions that should be in validators
        const expectPatterns = [/expect\(/, /expect\.soft\(/];

        expectPatterns.forEach((pattern) => {
          if (pattern.test(trimmedLine)) {
            this.addIssue(
              "HIGH",
              "Expect assertion found in test file",
              lineNumber,
              "Move assertions to validator functions in /validators directory. Test files should only call validator functions.",
            );
            return; // Only add once per line
          }
        });
      });
    }
  }

  /**
   * Add a positive aspect
   */
  addPositive(description, line) {
    this.positiveAspects.push({ description, line });
  }

  /**
   * Print results for current file
   */
  printFileResults() {
    if (this.issues.length > 0) {
      console.log("\n### Issues Found:");
      this.issues.forEach((issue) => {
        const icon = issue.severity === "HIGH" ? "🚨" : issue.severity === "MEDIUM" ? "⚠️" : "ℹ️";
        console.log(`- ${icon} [${issue.severity}] ${issue.description} (line ${issue.line})`);
        if (issue.suggestion) {
          console.log(`  💡 Suggestion: ${issue.suggestion}`);
        }
      });
    }

    if (this.positiveAspects.length > 0) {
      console.log("\n### Positive Aspects:");
      this.positiveAspects.forEach((pos) => {
        console.log(`✅ ${pos.description} (line ${pos.line})`);
      });
    }

    const score = Math.max(
      10 - this.issues.filter((i) => i.severity === "HIGH").length * 3 - this.issues.filter((i) => i.severity === "MEDIUM").length * 1,
      0,
    );
    console.log(`\n### Overall Score: ${score}/10\n`);
  }

  /**
   * Print overall summary
   */
  printSummary() {
    console.log("📊 Review Summary");
    console.log("================");
    console.log("Run completed. Check individual file scores above.");
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  let targetPath = ".";

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Playwright Code Review Agent

Usage:
  node playwright-code-review-agent-tests.js [options] [path]

Options:
  --help, -h     Show this help message
  --all          Review all test files including .js
  --version      Show version

Examples:
  node playwright-code-review-agent-tests.js tests/
  node playwright-code-review-agent-tests.js login.spec.ts
  node playwright-code-review-agent-tests.js --all [path]
    `);
    process.exit(0);
  }

  if (args.includes("--all")) {
    options.all = true;
    args.splice(args.indexOf("--all"), 1);
  }

  if (args.length > 0) {
    targetPath = args[0];
  }

  const reviewer = new PlaywrightCodeReviewer();
  reviewer.review(targetPath, options).catch(console.error);
}

module.exports = PlaywrightCodeReviewer;
