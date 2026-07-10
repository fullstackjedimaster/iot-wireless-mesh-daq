"use client";

import { useEffect, useRef, useState } from "react";

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

export default function LogPanel({ title, source }: LogPanelProps) {
    const [lines, setLines] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const bodyRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        let alive = true;

        async function loadLogs() {
            try {
                const res = await fetch(`/api/logs/${source}?lines=120`, {
                    cache: "no-store",
                });

                if (!res.ok) {
                    throw new Error(`Log request failed: ${res.status}`);
                }

                const data = (await res.json()) as LogResponse;

                if (alive) {
                    setLines(Array.isArray(data.lines) ? data.lines : []);
                    setError(null);
                }
            } catch (err) {
                if (alive) {
                    setError(err instanceof Error ? err.message : "Failed to load logs");
                }
            }
        }

        void loadLogs();
        const intervalId = window.setInterval(() => void loadLogs(), 3000);

        return () => {
            alive = false;
            window.clearInterval(intervalId);
        };
    }, [source]);

    useEffect(() => {
        const body = bodyRef.current;
        if (!body) return;
        body.scrollTop = body.scrollHeight;
    }, [lines]);

    return (
        <section className="daq-log-panel" style={{ width: "100%", minWidth: 0 }}>
            <div className="daq-log-title">{title}</div>

            {error ? (
                <div className="daq-log-error">{error}</div>
            ) : (
                <pre
                    ref={bodyRef}
                    className="daq-log-body"

                >
                    {lines.length > 0 ? lines.join("\n") : "No log output yet."}
                </pre>
            )}
        </section>
    );
}
