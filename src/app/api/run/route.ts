import { NextResponse } from 'next/server';
import { runRemoteCommands } from '@/lib/ssh';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providedPassword = (body as { password?: string })?.password ?? '';

    const APP_PASSWORD = process.env.APP_PASSWORD ?? '';
    if (!APP_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'APP_PASSWORD not set' }, { status: 500 });
    }

    if (providedPassword !== APP_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 });
    }

    const {
      SSH_HOST,
      SSH_PORT,
      SSH_USER,
      SSH_PASSWORD,
      SSH_PRIVATE_KEY,
      SSH_COMMAND,
      SSH_TIMEOUT_MS,
    } = process.env as Record<string, string | undefined>;

    if (!SSH_HOST || !SSH_USER || (!SSH_PASSWORD && !SSH_PRIVATE_KEY)) {
      return NextResponse.json({ ok: false, error: 'SSH_HOST, SSH_USER, and SSH_PASSWORD or SSH_PRIVATE_KEY are required' }, { status: 500 });
    }

    const commands = (SSH_COMMAND ?? '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (commands.length === 0) {
      return NextResponse.json({ ok: false, error: 'SSH_COMMAND is empty' }, { status: 500 });
    }

    // Notify via Telegram that a restart was triggered
    const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env as Record<string, string | undefined>;
    try {
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        // Determine client IP (works in Node runtime; Vercel sets x-forwarded-for)
        const ip =
          (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
          request.headers.get('x-real-ip') ||
          'unknown-ip';
        const text = `Restart initiated\nIP: ${ip}`;
        await sendTelegramMessage({ token: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID, text });
      }
    } catch (e) {
      // Swallow Telegram errors to avoid blocking main operation
    }

    await runRemoteCommands({
      host: SSH_HOST,
      port: SSH_PORT ? Number(SSH_PORT) : 22,
      username: SSH_USER,
      password: SSH_PASSWORD,
      privateKey: SSH_PRIVATE_KEY,
      commands,
      timeoutMs: SSH_TIMEOUT_MS ? Number(SSH_TIMEOUT_MS) : 120000,
    });

    // Return minimal success without any command output
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}