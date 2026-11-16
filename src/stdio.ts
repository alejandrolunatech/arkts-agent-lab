// The language server and the MCP server speak a protocol on stdout, and one stray line breaks it.
// This hands the protocol the only way to stdout and sends everything else to stderr.

import { Writable } from 'node:stream';

/**
 * Returns a stream that writes to stdout. After the call, `console.log` and any library that
 * writes to `process.stdout` land on stderr instead.
 */
export function reserveStdout(): Writable {
  const toStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = process.stderr.write.bind(process.stderr);
  return new Writable({
    write(chunk: Buffer, _encoding, done) {
      toStdout(chunk, done);
    },
  });
}
