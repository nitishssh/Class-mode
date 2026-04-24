/**
 * Handler for the /nemoclaw slash command (chat interface).
 *
 * Supports subcommands:
 *   /nemoclaw status   - show sandbox/blueprint/inference state
 *   /nemoclaw eject    - rollback to host installation
 *   /nemoclaw          - show help
 */
import type { PluginCommandContext, PluginCommandResult, OpenClawPluginApi } from "../index.js";
export declare function handleSlashCommand(ctx: PluginCommandContext, _api: OpenClawPluginApi): PluginCommandResult;
//# sourceMappingURL=slash.d.ts.map