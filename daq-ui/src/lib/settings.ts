
export const settings = {
    DOCK_SCRIPT_URL:
        'https://rag.fullstackjedi.dev/dock-host.js',

    HOST_APP_ID:
         'iot-wireless-mesh-daq',

    HOST_DENSITY:
        'compact',

    CLOUD_API_BASE: process.env.NEXT_PUBLIC_CLOUD_API_BASE ?? "",
    BOOTSTRAP_HEALTH: "/health",
} as const;

export default settings;
