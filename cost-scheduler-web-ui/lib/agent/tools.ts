import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const executeCommandTool = tool(
    async ({ command }: { command: string }) => {
        console.log(`[Agent] Executing command: ${command}`);

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000, // 30 second timeout
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            });

            const output = stdout || stderr || 'Command executed successfully (no output)';
            console.log(`[Agent] Command Output Length: ${output.length}`);

            return output;
        } catch (error: any) {
            const errorMsg = `Command failed: ${error.message}\n${error.stderr || ''}`;
            console.error(`[Agent] Command Error:`, errorMsg);
            return errorMsg;
        }
    },
    {
        name: 'execute_command',
        description: 'Execute a shell command on the system. Use this to check system status, list files, inspect processes, or run AWS CLI commands. Always sanitize and validate commands for security.',
        schema: z.object({
            command: z.string().describe('The shell command to execute'),
        }),
    }
);
