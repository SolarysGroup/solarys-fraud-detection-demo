"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { Message } from "./types";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "px-4 py-3 text-sm",
          isUser
            ? "max-w-[85%] bg-blue-600 text-white"
            : "w-full bg-zinc-800 text-zinc-100"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <div
          className={cn(
            "mt-2 text-xs",
            isUser ? "text-blue-200" : "text-zinc-500"
          )}
        >
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
