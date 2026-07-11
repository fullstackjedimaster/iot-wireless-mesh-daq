"use client";

import { useEffect, useState } from "react";

type LogSource = "mesh" | "cloud";

type LogResponse = {
    name: string;
    path?: string;
    files?: string[];
    lines: string[];
};

type LogPanelProps = {
    title: string;
    source: LogSource;
};

const MAX_LINES = 7;
const POLL_INTERVAL_MS = 3000;

function getRecentLines(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((line): line is string => typeof line === "string")
        .slice(-MAX_LINES);
}

export default function LogPanel({
    title,
    source,
}: LogPanelProps) {
    const [lines, setLines] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let intervalId: number | undefined;

        async function loadLogs(): Promise<void> {
            try {
                const response = await fetch(
                    `/api/logs/${source}?lines=${MAX_LINES}`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        `Log request failed: ${response.status}`,
                    );
                }

                const data = (await response.json()) as LogResponse;

                setLines(getRecentLines(data.lines));
                setError(null);
            } catch (caughtError) {
                if (controller.signal.aborted) {
                    return;
                }

                setError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : "Failed to load logs",
                );
            }
        }

        void loadLogs();

        intervalId = window.setInterval(() => {
            void loadLogs();
        }, POLL_INTERVAL_MS);

        return () => {
            controller.abort();

            if (intervalId !== undefined) {
                window.clearInterval(intervalId);
            }
        };
    }, [source]);

    return (
        <section
            className="daq-log-panel"
            aria-label={`${title} log`}
        >
            <div className="daq-log-title">{title}</div>

            {error ? (
                <div
                    className="daq-log-error"
                    role="alert"
                >
                    {error}
                </div>
            ) : (
                <pre
                    className="daq-log-body"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {lines.length > 0
                        ? lines.join("\n")
                        : "No log output yet."}
                </pre>
            )}
        </section>
    );
}