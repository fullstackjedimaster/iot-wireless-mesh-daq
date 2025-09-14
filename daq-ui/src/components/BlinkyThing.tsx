"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * BlinkyThing™ — tiny, unobtrusive, purely-for-vibes indicator.
 *
 * Features:
 * - 3 lights blink in random or sequential order (default: random).
 * - Small footprint & no external deps.
 * - Accessible (aria-hidden by default; optional label).
 * - Click Easter egg: cycles modes (random → sequential → pulse → off → random).
 * - Long-press (600ms) toggles a minimal control strip (speed + opacity).
 * - Optional "stealth" mode (low opacity until hover/focus).
 * - Fully styleable via props; works with or without Tailwind.
 */
export type BlinkyThingMode = "random" | "sequential" | "pulse" | "off";

export type BlinkyThingProps = {
    /** Pixel size of the whole widget (width auto-scales). */
    size?: number;                  // default 36
    /** Light diameter in pixels. */
    dotSize?: number;               // default 6
    /** Gap between lights in pixels. */
    gap?: number;                   // default 6
    /** Colors for the three lights. */
    colors?: [string, string, string]; // default ["#2DD4BF","#F59E0B","#EF4444"] teal/amber/red
    /** Blink interval in ms. */
    intervalMs?: number;            // default 850
    /** Initial mode. */
    mode?: BlinkyThingMode;         // default "random"
    /** Lower opacity until user hover/focus for stealthy vibes. */
    stealth?: boolean;              // default true
    /** Wrap in a subtle rounded card with shadow. */
    framed?: boolean;               // default false
    /** Additional className for wrapper (e.g., "absolute bottom-3 right-3"). */
    className?: string;
    /** Inline style override for wrapper. */
    style?: React.CSSProperties;
    /** Optional accessible label (otherwise aria-hidden). */
    ariaLabel?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const BlinkyThing: React.FC<BlinkyThingProps> = ({
                                                            size = 36,
                                                            dotSize = 6,
                                                            gap = 6,
                                                            colors = ["#2DD4BF", "#F59E0B", "#EF4444"], // teal / amber / red
                                                            intervalMs = 850,
                                                            mode: initialMode = "random",
                                                            stealth = true,
                                                            framed = false,
                                                            className,
                                                            style,
                                                            ariaLabel,
                                                        }) => {
    const [mode, setMode] = useState<BlinkyThingMode>(initialMode);
    const [activeIdx, setActiveIdx] = useState<number>(0);
    const [pulseT, setPulseT] = useState<number>(0); // 0..1 for pulse mode
    const [showControls, setShowControls] = useState<boolean>(false);
    const [speed, setSpeed] = useState<number>(intervalMs); // live-speed in UI
    const [opacity, setOpacity] = useState<number>(stealth ? 0.35 : 1);

    const holdTimerRef = useRef<number | null>(null);
    const pulseRAF = useRef<number | null>(null);

    // compute layout width
    const totalWidth = useMemo(() => {
        return dotSize * 3 + gap * 2 + 8; // + small padding for the wrapper
    }, [dotSize, gap]);

    // Mode cycling (Easter egg): click to rotate modes
    const cycleMode = () => {
        const order: BlinkyThingMode[] = ["random", "sequential", "pulse", "off"];
        const i = order.indexOf(mode);
        setMode(order[(i + 1) % order.length]);
    };

    // Long-press (600ms) toggles controls
    const onPointerDown = () => {
        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = window.setTimeout(() => setShowControls((v) => !v), 600);
    };
    const onPointerUpOrLeave = () => {
        if (holdTimerRef.current) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    };

    // Blinking logic for random / sequential
    useEffect(() => {
        if (mode === "pulse") return; // handled by RAF below
        if (mode === "off") return;

        const ms = clamp(speed, 150, 4000);
        const id = window.setInterval(() => {
            setActiveIdx((prev) => {
                if (mode === "sequential") {
                    return (prev + 1) % 3;
                } else {
                    // random but avoid same index twice for more obvious blinking
                    let next = Math.floor(Math.random() * 3);
                    if (next === prev) next = (next + 1) % 3;
                    return next;
                }
            });
        }, ms);

        return () => window.clearInterval(id);
    }, [mode, speed]);

    // Pulse mode: smoothly fade each dot in n out (RAF)
    useEffect(() => {
        if (mode !== "pulse") {
            if (pulseRAF.current) cancelAnimationFrame(pulseRAF.current);
            pulseRAF.current = null;
            return;
        }
        let start: number | null = null;
        const loop = (ts: number) => {
            if (start === null) start = ts;
            const elapsed = ts - start;
            const ms = clamp(speed, 300, 4000);
            // 0..1 using sine ease (smooth in/out)
            const t = (elapsed % ms) / ms;
            const eased = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); // sine loop 0..1..0
            setPulseT(eased);
            pulseRAF.current = requestAnimationFrame(loop);
        };
        pulseRAF.current = requestAnimationFrame(loop);
        return () => {
            if (pulseRAF.current) cancelAnimationFrame(pulseRAF.current);
            pulseRAF.current = null;
        };
    }, [mode, speed]);

    // derived dot opacities
    const opacities = useMemo<[number, number, number]>(() => {
        if (mode === "off") return [0.15, 0.15, 0.15];
        if (mode === "pulse") {
            // lead dot pulses strongest, neighbors trail
            const a = lerp(0.25, 1, pulseT);
            const b = lerp(0.20, 0.9, (pulseT + 0.33) % 1);
            const c = lerp(0.20, 0.9, (pulseT + 0.66) % 1);
            return [a, b, c];
        }
        // blinking: one “on”, others faint
        return [0, 1, 2].map((i) => (i === activeIdx ? 1 : 0.25)) as [number, number, number];
    }, [mode, activeIdx, pulseT]);

    // wrapper styles (works with or without Tailwind)
    const wrapBase: React.CSSProperties = {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: Math.max(totalWidth + 8, size),
        height: size,
        padding: 4,
        borderRadius: 8,
        background: framed ? "rgba(0,0,0,0.04)" : "transparent",
        boxShadow: framed ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
        transition: "opacity 180ms ease, transform 180ms ease",
        cursor: "pointer",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        opacity: stealth ? opacity : 1,
    };

    const rowStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
    };

    const dotStyle = (i: number): React.CSSProperties => ({
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize / 2,
        background: colors[i],
        opacity: clamp(opacities[i], 0, 1),
        transition: "opacity 180ms ease",
        boxShadow: `0 0 ${Math.max(2, Math.floor(dotSize/2))}px ${colors[i]}33`,
    });

    const controlsStyle: React.CSSProperties = {
        marginTop: 6,
        width: "100%",
        display: showControls ? "grid" : "none",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        alignItems: "center",
    };

    // Hover bumps opacity in stealth mode
    const onMouseEnter = () => stealth && setOpacity(1);
    const onMouseLeave = () => stealth && setOpacity(0.35);

    return (
        <div
            role={ariaLabel ? "img" : undefined}
            aria-label={ariaLabel}
            aria-hidden={ariaLabel ? undefined : true}
            title="BlinkyThing™"
            className={className}
            style={{ ...wrapBase, ...style }}
            onClick={cycleMode}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUpOrLeave}
            onPointerLeave={onPointerUpOrLeave}
        >
            <div style={rowStyle}>
                <span style={dotStyle(0)} />
                <span style={dotStyle(1)} />
                <span style={dotStyle(2)} />
            </div>

            {/* Minimal controls (long-press to toggle) */}
            <div style={controlsStyle}>
                <label style={{ fontSize: 10, opacity: 0.75, textAlign: "center" }}>
                    Speed
                    <input
                        type="range"
                        min={150}
                        max={3000}
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        style={{ width: "100%" }}
                        aria-label="Blinky speed"
                    />
                </label>
                <label style={{ fontSize: 10, opacity: 0.75, textAlign: "center" }}>
                    Opacity
                    <input
                        type="range"
                        min={0.15}
                        max={1}
                        step={0.05}
                        value={stealth ? opacity : 1}
                        onChange={(e) => stealth && setOpacity(Number(e.target.value))}
                        style={{ width: "100%" }}
                        aria-label="Blinky opacity"
                    />
                </label>
            </div>
        </div>
    );
};

export default BlinkyThing;
