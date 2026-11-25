declare module 'jsfxr' {
  export const sfxr: {
    toWave(synthdef: Record<string, number>): { dataURI: string };
    generate(algorithm: string, options?: Record<string, number>): Record<string, number>;
  };
  const jsfxr: { sfxr: typeof sfxr };
  export default jsfxr;
}
