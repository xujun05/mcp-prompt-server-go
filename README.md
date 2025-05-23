# MCP Prompt Server - TypeScript Version

This is a TypeScript implementation of the MCP Prompt Server, originally written in Go.
It allows loading, managing, and serving prompt templates via the Model Context Protocol (MCP).

## Prerequisites

- Node.js (v16 or newer recommended)
- npm (usually comes with Node.js)

## Installation

1.  Clone the repository (if applicable).
2.  Navigate to the project directory.
3.  Install dependencies:
    ```bash
    npm install
    ```

## Build

To compile the TypeScript code to JavaScript:

```bash
npm run build
```
This will output files to the `dist` directory.

## Running the Server

After building the project, you can run the server using the `start` script:

-   **Default (Network SSE on port 8888):**
    ```bash
    npm start
    ```
    Or explicitly:
    ```bash
    npm start -- --addr :8888
    ```

-   **With Stdio Transport:**
    ```bash
    npm start -- --stdio
    ```

-   **On a different address and port:**
    ```bash
    npm start -- --addr 127.0.0.1:9000
    ```

## Management Tools

The server provides several management tools accessible via MCP tool calls:

-   `reload_prompts`: Hot reloads all prompt templates from the `prompts` directory.
-   `add_prompt`: Adds a new prompt. Requires `category`, `filename`, and `yaml_content`.
-   `get_prompt_generate_rule`: Returns the content of `generate_rule.txt` which defines the YAML structure for prompts.
-   `get_prompt_names`: Lists all available prompt names.
