import { Plugin } from "@opencode-ai/plugin";
import { existsSync, appendFileSync } from "fs";
import { join } from "path";

export const CommandHooksPlugin: Plugin = async ({ $, client, directory }) => {
  const logFile = join(directory, ".opencode/plugins/commandHooks.log");
  let lastCommandName: string | null = null;

  const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  const CURRENT_LOG_LEVEL = "error"; // Change to "info" or "debug" to log more details

  const log = (
    message: string,
    level: "info" | "debug" | "warn" | "error" = "info",
    extra?: any,
  ) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[CURRENT_LOG_LEVEL]) return;
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}][${level.toUpperCase()}] ${message} ${extra ? JSON.stringify(extra) : ""}\n`;
    try {
      appendFileSync(logFile, logEntry);
    } catch (e) {}
    client.app
      .log({
        body: { service: "command-hooks", level, message, extra },
      })
      .catch(() => {});
  };

  const showToast = (message: string, variant: "info" | "success" | "warning" | "error" = "info", duration = 3000) => {
    const variantLevel = variant === "success" ? "info" : variant === "warning" ? "warn" : variant;
    if (LOG_LEVELS[variantLevel] < LOG_LEVELS[CURRENT_LOG_LEVEL]) return;

    client.tui.showToast({
      body: { message, variant, duration }
    }).catch(() => {});
  };

  const logToSession = async (sessionID: string, title: string, result: { stdout: string, stderr: string, exitCode: number }) => {
    const isSuccess = result.exitCode === 0;
    const divider = "----------------------------------------";

    let text = `${divider}\n`;
    text += `${title}\n`;
    text += `${divider}\n\n`;

    if (result.stdout.trim() || result.stderr.trim()) {
      if (result.stdout.trim()) text += `${result.stdout.trim()}\n`;
      if (result.stderr.trim()) text += `${result.stderr.trim()}\n`;
    } else {
      text += `(No output)\n`;
    }

    text += `\n${divider}\n`;
    if (isSuccess) {
      text += `[OK] Success`;
    } else {
      text += `[FAIL] Exit code: ${result.exitCode}`;
    }

    try {
      await client.session.prompt({
        path: { id: sessionID },
        body: {
          parts: [{ type: "text", text }],
          noReply: true
        }
      });
    } catch (e) {
      log(`Failed to log to session`, "error", { error: e.message });
    }
  };

  log("Plugin initialized - Tracking commands");

  const commandsDir = join(directory, ".opencode/commands");

  const runPreScript = async (cmdName: string, sessionID?: string, args: string = "") => {
    const normalized = cmdName.startsWith("/") ? cmdName.slice(1) : cmdName;
    const preScript = join(commandsDir, `${normalized}.pre.sh`);

    if (existsSync(preScript)) {
      log(`Running pre-script for ${normalized}`, "info", { script: preScript });
      showToast(`Running pre-script for ${normalized}...`, "info", 600000);
      
      try {
        const result = await $`bash ${preScript} ${args}`.quiet().nothrow();
        const stdout = result.stdout.toString();
        const stderr = result.stderr.toString();
        
        log(`Pre-script finished`, "info", {
          exitCode: result.exitCode,
          stdout,
          stderr,
        });

        if (sessionID && (result.exitCode !== 0 || LOG_LEVELS["info"] >= LOG_LEVELS[CURRENT_LOG_LEVEL])) {
          await logToSession(sessionID, `Pre-script: ${normalized}`, {
            stdout,
            stderr,
            exitCode: result.exitCode
          });
        }
        
        if (result.exitCode === 0) {
          showToast(`Pre-script ${normalized} finished`, "success", 3000);
        } else {
          showToast(`Pre-script ${normalized} failed`, "error", 5000);
        }
        
        return stdout;
      } catch (error) {
        log(`Pre-script error`, "error", { error });
        showToast(`Pre-script error for ${normalized}`, "error", 5000);
      }
    }
    return null;
  };

  const runPostScript = async (cmdName: string, sessionID?: string, args: string = "") => {
    const normalized = cmdName.startsWith("/") ? cmdName.slice(1) : cmdName;
    const postScript = join(commandsDir, `${normalized}.post.sh`);

    if (existsSync(postScript)) {
      log(`Running post-script for ${normalized}`, "info", { script: postScript });
      showToast(`Running post-script for ${normalized}...`, "info", 600000);

      try {
        const result = await $`bash ${postScript} ${args}`.quiet().nothrow();
        const stdout = result.stdout.toString();
        const stderr = result.stderr.toString();

        log(`Post-script finished`, "info", {
          exitCode: result.exitCode,
          stdout,
          stderr,
        });

        if (sessionID && (result.exitCode !== 0 || LOG_LEVELS["info"] >= LOG_LEVELS[CURRENT_LOG_LEVEL])) {
          await logToSession(sessionID, `Post-script: ${normalized}`, {
            stdout,
            stderr,
            exitCode: result.exitCode
          });
        }
        
        if (result.exitCode === 0) {
          showToast(`Post-script ${normalized} finished`, "success", 3000);
        } else {
          showToast(`Post-script ${normalized} failed`, "error", 5000);
        }
      } catch (error) {
        log(`Post-script error`, "error", { error });
        showToast(`Post-script error for ${normalized}`, "error", 5000);
      }
    }
  };

  return {
    name: "Command Hooks",
    description: "Automatically executes .pre.sh and .post.sh scripts for OpenCode commands.",
    "command.execute.before": async (input) => {
      lastCommandName = input.command;
      const args = input.text || input.arguments || "";
      log(`Command execution started: ${lastCommandName}`, "debug");
      await runPreScript(lastCommandName, input.sessionID, args);
    },
    event: async ({ event }) => {
      if (event.type === "command.executed") {
        const props = (event as any).properties || (event as any).data || {};
        const cmdName = props.name || props.command || lastCommandName;
        const sessionID = props.sessionID;
        const args = props.text || props.arguments || "";
        
        if (cmdName) {
          await runPostScript(cmdName, sessionID, args);
          if (cmdName === lastCommandName) lastCommandName = null;
        }
      }
    },
  };
};

export default CommandHooksPlugin;
