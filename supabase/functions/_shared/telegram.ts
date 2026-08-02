// =============================================================================
// TELEGRAM — Bot API sender for Supabase Edge Functions
// =============================================================================
// Minimal, dependency-free wrapper around sendMessage. Handles the two things
// that actually break Telegram delivery in practice:
//
//   1. The 4096-character hard limit per message. Long digests are split on
//      line boundaries (never mid-line, so a table row is never cut in half)
//      and sent as a numbered sequence.
//   2. HTML parse-mode escaping. Telegram rejects the whole message with
//      400 "can't parse entities" if an unescaped < or & appears — so a
//      customer named "Smith & Sons" would silently kill the entire digest.
//      Everything interpolated into a message must go through esc().
//
// Config comes from edge-function secrets:
//   TELEGRAM_BOT_TOKEN   from @BotFather
//   TELEGRAM_CHAT_ID     numeric user id, or -100... for a channel/group
// =============================================================================

const TELEGRAM_MAX = 4096;
// Leave room for the " (1/3)" continuation marker appended to split chunks.
const CHUNK_BUDGET = TELEGRAM_MAX - 32;

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramResult {
  ok: boolean;
  sent: number;
  errors: string[];
}

/** Escape text for Telegram parse_mode: 'HTML'. */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function readTelegramConfig(): TelegramConfig | null {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/**
 * Split on line boundaries so formatting survives. A single line longer than
 * the budget (shouldn't happen with our digest, but a stack trace could) is
 * hard-cut as a last resort rather than dropped.
 */
export function chunkMessage(text: string, budget = CHUNK_BUDGET): string[] {
  if (text.length <= budget) return [text];

  const chunks: string[] = [];
  let current = '';

  for (const rawLine of text.split('\n')) {
    let line = rawLine;
    while (line.length > budget) {
      if (current) { chunks.push(current); current = ''; }
      chunks.push(line.slice(0, budget));
      line = line.slice(budget);
    }
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > budget) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendOne(
  cfg: TelegramConfig,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${cfg.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    const json = await res.json();
    if (!json.ok) return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Send a (possibly long) message. Chunks are sent sequentially so Telegram
 * preserves ordering — parallel sends arrive scrambled.
 */
export async function sendTelegram(
  cfg: TelegramConfig,
  text: string,
): Promise<TelegramResult> {
  const chunks = chunkMessage(text);
  const errors: string[] = [];
  let sent = 0;

  for (let i = 0; i < chunks.length; i++) {
    const suffix = chunks.length > 1 ? `\n\n<i>(${i + 1}/${chunks.length})</i>` : '';
    const r = await sendOne(cfg, chunks[i] + suffix);
    if (r.ok) sent++;
    else errors.push(`chunk ${i + 1}: ${r.error}`);
  }

  return { ok: errors.length === 0, sent, errors };
}
