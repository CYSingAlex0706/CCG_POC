/* External adapter for the customer's existing JSON stderr logger.
 * Beacon handles traces; this adapter only enriches complete JSON log lines.
 * It does not modify src/server.js or introduce a new business logging API.
 */
'use strict';
const { context, trace, isSpanContextValid } = require('@opentelemetry/api');
const originalWrite = process.stderr.write;
process.stderr.write = function (chunk, encoding, callback) {
  let output = chunk;
  try {
    // The existing logLine writes one complete JSON string ending in a newline.
    if (typeof chunk === 'string' && chunk.endsWith('\n')) {
      const record = JSON.parse(chunk);
      if (record && record.ts && record.level && record.msg) {
        record.service = process.env.OTEL_SERVICE_NAME;
        record.status = record.level;
        record.message = record.msg;
        const span = trace.getSpan(context.active());
        const sc = span && span.spanContext();
        // Startup/background logs may have no request Span; never invent IDs.
        if (sc && isSpanContextValid(sc)) {
          record.trace_id = sc.traceId;
          record.span_id = sc.spanId;
        }
        output = JSON.stringify(record) + '\n';
      }
    }
  } catch (_) { /* Preserve non-JSON writes, buffers and partially written lines. */ }
  return originalWrite.call(this, output, encoding, callback);
};
