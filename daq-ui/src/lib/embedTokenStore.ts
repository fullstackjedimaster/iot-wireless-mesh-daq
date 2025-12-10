// daq-ui/src/lib/embedTokenStore.ts

let currentToken: string | null = null;

export function setEmbedToken(token: string | null) {
    currentToken = token;
}

export function getEmbedToken(): string | null {
    return currentToken;
}
