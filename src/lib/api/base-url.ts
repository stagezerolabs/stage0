const configuredSennaApiUrl = (
  import.meta.env.VITE_SENNA_CHAT_API_URL as string | undefined
)?.trim().replace(/\/$/, '');

export const SENNA_API_URL =
  configuredSennaApiUrl || (import.meta.env.DEV ? 'http://localhost:8788' : 'https://api.stage0.xyz');
