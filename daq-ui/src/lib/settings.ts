function required(name: string, value: string | undefined): string {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export const settings = {
    DOCK_SCRIPT_URL:
        'https://rag.fullstackjedi.dev/dock-host.js',

    HOST_APP_ID:
         'iot-wireless-mesh-daq',

    HOST_DENSITY:
        'compact',

    CLOUD_API_BASE: process.env.NEXT_PUBLIC_CLOUD_API_BASE ?? "",
    BOOTSTRAP_HEALTH: required(
        "NEXT_PUBLIC_BOOTSTRAP_HEALTH",
        process.env.NEXT_PUBLIC_BOOTSTRAP_HEALTH,
    ),
    EMBED_LOCK_ENABLED:
        process.env.NEXT_PUBLIC_EMBED_LOCK_ENABLED === "true",
} as const;

export default settings;
