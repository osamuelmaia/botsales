/**
 * TelegramService — grammy-based wrapper for managing multiple bot instances.
 *
 * Used by the BullMQ worker (workers/bot-worker.ts) for local development
 * polling mode. In production, Telegram pushes updates via webhooks to
 * /api/telegram/[botId] which uses bot-runner.ts directly.
 */

import { Bot, Context } from "grammy"

// ─── Active polling bots registry ────────────────────────────────────────────

const activeBots = new Map<string, Bot>()

// ─── TelegramService ──────────────────────────────────────────────────────────

export class TelegramService {
  /**
   * Send a plain text message. Supports MarkdownV2.
   */
  static async sendMessage(
    token: string,
    chatId: number,
    text: string,
    options?: { parseMode?: "Markdown" | "MarkdownV2" | "HTML"; disableNotification?: boolean }
  ): Promise<void> {
    const bot = new Bot(token)
    await bot.api.sendMessage(chatId, text, {
      parse_mode: options?.parseMode ?? "Markdown",
      ...(options?.disableNotification ? { disable_notification: true } : {}),
    })
  }

  /**
   * Send a photo with optional caption.
   */
  static async sendPhoto(
    token: string,
    chatId: number,
    imageUrl: string,
    caption?: string,
    options?: { parseMode?: "Markdown" | "MarkdownV2" | "HTML" }
  ): Promise<void> {
    const bot = new Bot(token)
    await bot.api.sendPhoto(chatId, imageUrl, {
      ...(caption ? { caption, parse_mode: options?.parseMode ?? "Markdown" } : {}),
    })
  }

  /**
   * Send a photo from a base64-encoded buffer (e.g. PIX QR code from Asaas).
   */
  static async sendPhotoBuffer(
    token: string,
    chatId: number,
    base64Image: string,
    caption?: string
  ): Promise<void> {
    const { InputFile } = await import("grammy")
    const bot = new Bot(token)
    const buffer = Buffer.from(base64Image, "base64")
    await bot.api.sendPhoto(chatId, new InputFile(buffer, "qrcode.png"), {
      ...(caption ? { caption, parse_mode: "Markdown" } : {}),
    })
  }

  /**
   * Send a message with an inline keyboard.
   */
  static async sendInlineKeyboard(
    token: string,
    chatId: number,
    text: string,
    buttons: Array<{ text: string; url?: string; callbackData?: string }>
  ): Promise<void> {
    const bot = new Bot(token)
    const keyboard = buttons.map((b) =>
      b.url
        ? [{ text: b.text, url: b.url }]
        : [{ text: b.text, callback_data: b.callbackData ?? "" }]
    )
    await bot.api.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    })
  }

  /**
   * Start grammy long-polling for a bot.
   * Registers the /start command and callback_query handlers before polling begins.
   * Safe to call multiple times — stops any existing instance first.
   */
  static startPolling(
    token: string,
    botId: string,
    onStart: (ctx: Context) => Promise<void>,
    onCallbackQuery?: (ctx: Context, data: string) => Promise<void>
  ): Bot {
    // Stop existing instance if any
    TelegramService.stopPolling(botId)

    const bot = new Bot(token)

    bot.command("start", async (ctx) => {
      try {
        await onStart(ctx)
      } catch (err) {
        console.error(`[bot:${botId}] /start error:`, err)
      }
    })

    // Handle callback_query for flow-mode inline buttons
    bot.on("callback_query:data", async (ctx) => {
      await ctx.answerCallbackQuery()
      const data = ctx.callbackQuery.data
      if (data && onCallbackQuery) {
        try {
          await onCallbackQuery(ctx, data)
        } catch (err) {
          console.error(`[bot:${botId}] callback_query error:`, err)
        }
      }
    })

    bot.catch((err) => {
      console.error(`[bot:${botId}] grammy error:`, err.message)
    })

    bot.start({
      onStart: () => console.log(`[bot:${botId}] polling started`),
    })

    activeBots.set(botId, bot)
    return bot
  }

  /**
   * Stop grammy long-polling for a bot.
   */
  static async stopPolling(botId: string): Promise<void> {
    const bot = activeBots.get(botId)
    if (bot) {
      await bot.stop()
      activeBots.delete(botId)
      console.log(`[bot:${botId}] polling stopped`)
    }
  }

  /**
   * Get an active bot instance by botId.
   */
  static getBotInstance(botId: string): Bot | undefined {
    return activeBots.get(botId)
  }

  /**
   * Stop all active polling bots (used on worker shutdown).
   */
  static async stopAll(): Promise<void> {
    for (const botId of Array.from(activeBots.keys())) {
      await TelegramService.stopPolling(botId)
    }
  }

  /**
   * Ban (and prevent re-entry) of a user from a group.
   * The bot must be an admin with can_restrict_members permission.
   */
  static async banChatMember(
    token: string,
    groupChatId: string,
    userId: string
  ): Promise<void> {
    const bot = new Bot(token)
    await bot.api.banChatMember(groupChatId, parseInt(userId, 10))
  }

  /**
   * Lift a ban — allows the user to rejoin via invite link.
   */
  static async unbanChatMember(
    token: string,
    groupChatId: string,
    userId: string
  ): Promise<void> {
    const bot = new Bot(token)
    await bot.api.unbanChatMember(groupChatId, parseInt(userId, 10), {
      only_if_banned: true,
    })
  }

  /**
   * Create a single-use invite link for a group.
   * Used to send a fresh link to a subscriber after unbanning.
   */
  static async createChatInviteLink(
    token: string,
    groupChatId: string
  ): Promise<string> {
    const bot = new Bot(token)
    const result = await bot.api.createChatInviteLink(groupChatId, {
      member_limit: 1,
    })
    return result.invite_link
  }
}
