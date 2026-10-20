// Pure functions: Claude Code transcript text -> usage items grouped by Taipei date + model.

const TAIPEI_OFFSET_MS = 8 * 3600 * 1000;

/** UTC ISO timestamp -> 'YYYY-MM-DD' in Asia/Taipei (UTC+8, no DST). */
export function taipeiDate(timestamp) {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) throw new Error(`bad timestamp: ${timestamp}`);
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

const count = (n) => {
  if (n === undefined || n === null) return 0;
  if (!Number.isFinite(n) || n < 0) throw new Error(`bad token count: ${n}`);
  return n;
};

/**
 * Turns the text of a session's transcript files (main + subagents) into submission items.
 * Returns `{ items, skipped }` where `skipped` counts lines that could not be parsed.
 */
export function parseTranscripts(texts) {
  // message.id -> latest message. A response is logged once per content block; early lines can
  // carry a partial output_tokens (stop_reason null), so keep the line with the largest output.
  const messages = new Map();
  let skipped = 0;

  for (const text of texts) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      let entry;
      try {
        const json = JSON.parse(line);
        if (json?.type !== 'assistant' || !json.message?.usage) continue;
        entry = toEntry(json);
      } catch {
        skipped++;
        continue;
      }
      if (!entry) continue;
      const previous = messages.get(entry.id);
      if (!previous || entry.outputTokens >= previous.outputTokens) messages.set(entry.id, entry);
    }
  }

  const groups = new Map();
  for (const { usageDate, model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens } of messages.values()) {
    const key = `${usageDate}|${model}`;
    const item = groups.get(key) ?? {
      usageDate,
      model,
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    item.inputTokens += inputTokens;
    item.outputTokens += outputTokens;
    item.cacheWriteTokens += cacheWriteTokens;
    item.cacheReadTokens += cacheReadTokens;
    groups.set(key, item);
  }

  const items = [...groups.values()].sort(
    (a, b) => a.usageDate.localeCompare(b.usageDate) || a.model.localeCompare(b.model),
  );
  return { items, skipped };
}

/** One assistant line -> entry, or null when it should be ignored (<synthetic>, all-zero). Throws if malformed. */
function toEntry(json) {
  const { id, model, usage } = json.message;
  if (typeof id !== 'string' || !id) throw new Error('missing message.id');
  if (typeof model !== 'string' || !model) throw new Error('missing message.model');
  if (model === '<synthetic>') return null;
  const entry = {
    id,
    model,
    usageDate: taipeiDate(json.timestamp),
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cacheWriteTokens: count(usage.cache_creation_input_tokens),
    cacheReadTokens: count(usage.cache_read_input_tokens),
  };
  const total = entry.inputTokens + entry.outputTokens + entry.cacheWriteTokens + entry.cacheReadTokens;
  return total === 0 ? null : entry;
}
