function required(name: string, value: string | undefined): string {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export const settings = {
    RAG_DOCK_SCRIPT_URL: required(
        "NEXT_PUBLIC_RAG_DOCK_SCRIPT_URL",
        process.env.NEXT_PUBLIC_RAG_DOCK_SCRIPT_URL,
    ),
    HOST_APP_ID: required(
        "NEXT_PUBLIC_HOST_APP_ID",
        process.env.NEXT_PUBLIC_HOST_APP_ID,
    ),
    HOST_DENSITY: required(
        "NEXT_PUBLIC_HOST_DENSITY",
        process.env.NEXT_PUBLIC_HOST_DENSITY,
    ),
    CLOUD_API_BASE: process.env.NEXT_PUBLIC_CLOUD_API_BASE ?? "",
    BOOTSTRAP_HEALTH: required(
        "NEXT_PUBLIC_BOOTSTRAP_HEALTH",
        process.env.NEXT_PUBLIC_BOOTSTRAP_HEALTH,
    ),
    EMBED_LOCK_ENABLED:
        process.env.NEXT_PUBLIC_EMBED_LOCK_ENABLED === "true",
} as const;

export default settings;
