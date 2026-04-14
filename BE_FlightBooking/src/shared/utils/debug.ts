const isDebug = () => process.env.DEBUG === 'true';

export function debugLog(tag: string, ...args: unknown[]): void {
  if (isDebug()) {
    console.log(`[DEBUG][${tag}]`, ...args);
  }
}
