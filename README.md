# Playwright Code Review Agent

A specialized code review agent for Playwright test automation frameworks that ensures code quality, maintainability, and reliability.

## Files in This Directory

    go to /code-review folder

| File                               | Purpose                              | Usage                                              |
| ---------------------------------- | ------------------------------------ | -------------------------------------------------- |
| `playwright-code-review.md`        | Detailed review guidelines and rules | Reference manual for review standards              |
| `playwright-review-agent-tests.js` | Executable Node.js agent             | Main automated scanning tool only for tests folder |
| `package.json`                     | npm package configuration            | Package metadata and scripts                       |
| `README.md`                        | This documentation                   | Usage guide and examples                           |

## Quick Start

### Using with npm scripts

```bash
# Install the package locally
npm install

# Review all test files
npm run review

# Review all files including JavaScript
npm run review:all

# Test the agent
npm test
```

### Using with GitHub Copilot - Please use your local LLMs. DO NOT USE ANY CLOUD LLMs

You can invoke this agent through GitHub Copilot by asking:

- "Run the Playwright code review agent on my test files"
- "Check my Playwright tests for best practices using the prompts directory"
- "Review the test quality in the tests/ directory with playwright-review-agent.js"
- "Use the code review guidelines from playwright-code-review.md"

## Architecture Enforcement

The agent enforces strict separation of concerns based on file location:

### 📁 `/tests/*.spec.ts` - Test Files

**Strict Rules: NO locators, NO expect assertions allowed**

❌ **Forbidden in test files:**

```typescript
// ALL of these are HIGH priority violations:
const button = page.locator("#submit"); // ❌ Move to /pages
const submit = page.getByRole("button"); // ❌ Move to /pages
const error = page.getByText("Error"); // ❌ Move to /pages
expect(button).toBeVisible(); // ❌ Move to /validators
expect.soft(error).not.toBeVisible(); // ❌ Move to /validators
```

✅ **Allowed in test files:**

```typescript
// Only Page Object method calls:
const loginPage = new LoginPage(page);
await loginPage.login("user@example.com", "password");
```

### 📁 `/pages/*` - Page Object Layer

**Rules: Locators allowed, assertions NOT allowed**

✅ **Allowed in Page Objects:**

- All locator patterns: `page.getByRole()`, `page.locator()`, etc.
- Action methods that return Page Objects
- Readonly locator properties

❌ **Forbidden in Page Objects:**

- `expect()` assertions

### 📁 `/validators/*` - Validator Functions

**Rules: Assertions allowed, locators NOT allowed**

✅ **Allowed in Validators:**

- `expect()` and `expect.soft()` assertions
- Validation logic

❌ **Forbidden in Validators:**

- Locator definitions

## What It Checks

### 🚨 HIGH Priority Issues

- **Architecture violations**: Locators/expect in wrong directories
- **Bad locators**: CSS selectors like `.btn-primary`, XPath usage
- **Missing awaits**: Actions without proper async handling
- **Sleep statements**: `waitForTimeout()` usage
- **Flaky patterns**: Practices that cause unreliable tests

### ⚠️ MEDIUM Priority Issues

- **Poor assertions**: Using `isVisible()` instead of web-first assertions
- **Type violations**: Using `any` types, weak typing
- **POM violations**: Assertions in Page Objects
- **Hardcoded values**: URLs, selectors in test methods

### ✅ Best Practices It Promotes (Only in non-test files)

- **Accessible locators**: `page.getByRole()`, `page.getByLabel()`
- **Web-first assertions**: `expect(locator).toBeVisible()`
- **Test isolation**: Independent, parallel-ready tests
- **Strong typing**: Proper TypeScript usage
- **Clean architecture**: Proper separation of concerns

## Review Process

1. **File Discovery**: Automatically finds `.spec.ts` and `.test.ts` files
2. **Architecture Detection**: Identifies file type (test, page object, validator) based on path
3. **Line-by-Line Analysis**: Checks for anti-patterns and best practices
4. **Context-Aware Rules**: Applies different rules based on file location
5. **Structure Analysis**: Evaluates overall test architecture
6. **Scoring**: Provides 0-10 quality score for each file
7. **Actionable Feedback**: Specific suggestions with code examples

## Smart Detection Features

### Comment Detection

- Skips all commented lines (`//`, `#`, `/*`, `*`)
- Distinguishes between XPath selectors and comments containing `//`

### Path-Based Rules

- **Test files** (`/tests/*.spec.ts`): Strict architecture enforcement
- **Page Objects** (`/pages/*`): Locator validation, no assertions
- **Other files**: Standard best practice validation

### Duplicate Prevention

- Only one issue per line even if multiple patterns match
- Avoids flagging the same violation multiple times

## Example Output

### Test File Example (`tests/login.spec.ts`)

```
## File: tests/login.spec.ts
---

### Issues Found:
- 🚨 [HIGH] Locator found in test file (line 6)
  💡 Suggestion: Move locators to Page Object layer in /pages directory. Test files should only call Page Object methods.
- 🚨 [HIGH] Expect assertion found in test file (line 9)
  💡 Suggestion: Move assertions to validator functions in /validators directory. Test files should only call validator functions.

### Overall Score: 0/10
```

### Page Object Example (`pages/LoginPage.ts`)

```
## File: pages/LoginPage.ts
---

### Issues Found:
- ⚠️ [MEDIUM] Page Object contains assertions (line 0)
  💡 Suggestion: Move assertions to test files, keep POM for actions only

### Positive Aspects:
✅ Using getByRole() for accessible locators (line 12)
✅ Using readonly properties for locators (line 8)

### Overall Score: 8/10
```

## Integration Options

### Local Development

```bash
# Navigate to prompts directory
cd code-review/

# Install dependencies (none required)
npm install

# Run review on all test files
./playwright-review-agent-tests.js

# Run review on specific directory
./playwright-review-agent-tests.js ../src/tests/

# Run review including JavaScript files
./playwright-review-agent-tests.js --all
```

### VS Code Integration

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Playwright Code Review",
      "type": "shell",
      "command": "./code-review/playwright-review-agent.js",
      "args": ["${workspaceFolder}"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

## File-Specific Usage

### playwright-code-review.md

- **Purpose**: Complete reference manual for review standards
- **Usage**: Read to understand review criteria and best practices
- **Contains**: Detailed rules, examples, and comparison tables
- **When to use**: Before writing tests, during code reviews, training new team members

### playwright-review-agent.js

- **Purpose**: Automated scanning and analysis tool
- **Usage**: Execute directly or via npm scripts
- **Features**: Line-by-line analysis, scoring, actionable feedback
- **When to use**: Continuous integration, pre-commit checks, local development

### package.json

- **Purpose**: Package configuration and scripts
- **Usage**: npm integration, dependency management
- **Scripts**: `review`, `review:all`, `test`
- **When to use**: Standard npm workflow, CI/CD pipelines

### Contribution

Contributions welcome! Please feel free to submit issues or pull requests with:

New Agents configurations  
Performance optimizations  
Example workflows  
Documentation improvements
