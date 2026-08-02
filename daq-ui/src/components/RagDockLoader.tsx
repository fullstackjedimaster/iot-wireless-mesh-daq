"use client";

import { useEffect } from "react";

declare global {
    interface Window {
        RagDock?: {
            destroy(): void;
        };
    }
}

type RagDockLoaderProps = {
    scriptUrl: string;
    target: string;
    app: string;
    density: string;
};

export default function RagDockLoader({
    scriptUrl,
    target,
    app,
    density,
}: RagDockLoaderProps) {
    useEffect(() => {
        window.RagDock?.destroy();

        const script = document.createElement("script");
        script.src = scriptUrl;
        script.dataset.target = target;
        script.dataset.app = app;
        script.dataset.density = density;
        script.async = true;
        document.body.appendChild(script);

        return () => {
            window.RagDock?.destroy();
            script.remove();
        };
    }, [app, density, scriptUrl, target]);

    return null;
}
