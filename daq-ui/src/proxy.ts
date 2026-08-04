import { createEmbedProxy } from "@fsj/demo-kit/server";
export const proxy = createEmbedProxy({ audience: "iot-wireless-mesh-daq" });
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
