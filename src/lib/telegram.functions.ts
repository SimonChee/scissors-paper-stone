import { createServerFn } from "@tanstack/react-start";

export const notifyOpponentJoined = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => {
    const code = String(data?.code ?? "")
      .toUpperCase()
      .slice(0, 8);
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error("Invalid room code");
    return { code };
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const telegramKey = process.env["TELEGRAM_API_KEY"];
    const chatId = process.env["TELEGRAM_CHAT_ID"];
    if (!lovableKey || !telegramKey || !chatId) {
      return { sent: false, reason: "Telegram is not configured" as string | null };
    }

    const response = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: "HTML",
        text: `🤠 <b>Saloon Showdown</b>\nYour opponent just walked into room <b>${data.code}</b>. Seven rounds await — draw!`,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Telegram gateway failed [${response.status}]: ${errorBody}`);
      return { sent: false, reason: `Telegram request failed [${response.status}]: ${errorBody}` };
    }

    const payload = (await response.json()) as { ok?: boolean; description?: string };
    if (!payload.ok) {
      console.error(`Telegram error: ${payload.description ?? "unknown"}`);
      return { sent: false, reason: payload.description ?? "unknown" };
    }

    return { sent: true, reason: null };
  });
