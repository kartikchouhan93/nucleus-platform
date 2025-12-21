import { graph } from '@/lib/agent/graph';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse } from 'ai';

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        console.log('Incoming messages:', JSON.stringify(messages, null, 2));

        // Convert Vercel AI SDK messages to LangChain messages
        const validMessages = messages.map((m: any) => {
            let content = m.content;
            if (!content && m.parts) {
                // Extract text from parts if content is missing
                content = m.parts
                    .filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('');
            }
            // Ensure content is a string
            content = content || "";

            if (m.role === 'user') {
                return new HumanMessage({ content });
            } else if (m.role === 'assistant') {
                // If it has tool_calls, we need to reconstruct them
                // For simplicity in this adapter context, we mostly care about text content
                // unless we are re-hydratiing a complex state.
                // Vercel SDK sends toolInvocations, but LangChain expects tool_calls in AIMessage
                const toolCalls = m.toolInvocations?.map((ti: any) => ({
                    name: ti.toolName,
                    args: ti.args,
                    id: ti.toolCallId,
                    type: "tool_call" // Ensure type is set if needed by newer langchain
                })) || [];

                return new AIMessage({
                    content: content,
                    tool_calls: toolCalls
                });
            } else if (m.role === 'tool') {
                return new ToolMessage({
                    tool_call_id: m.toolCallId, // Vercel SDK uses toolCallId
                    content: content
                });
            }
            // Fallback
            return new HumanMessage({ content });
        });

        const stream = await graph.streamEvents(
            { messages: validMessages },
            {
                version: "v2",
            }
        );

        return createUIMessageStreamResponse({
            stream: toUIMessageStream(stream)
        });

    } catch (error) {
        console.error('[API Error]:', error);
        return new Response(
            JSON.stringify({
                error: unknownError(error)
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

function unknownError(error: unknown): string {
    return error instanceof Error ? error.message : 'Internal server error';
}
