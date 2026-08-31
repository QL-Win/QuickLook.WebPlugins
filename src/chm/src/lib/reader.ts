/**
 * ChmReader interface and browser implementation.
 * Provides random-access reads over a CHM file loaded as a Uint8Array.
 */

export interface ChmReader {
  read(offset: bigint, length: number): Promise<Uint8Array>;
  close?(): void | Promise<void>;
}

/** In-memory reader backed by a Uint8Array. Works in any environment including browsers. */
export function chmReaderFromBuffer(data: Uint8Array): ChmReader {
  return {
    read(offset: bigint, length: number): Promise<Uint8Array> {
      const start = Number(offset);
      const end = Math.min(start + length, data.length);
      return Promise.resolve(data.slice(start, end));
    },
  };
}
