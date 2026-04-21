/**
 * Email sending via Resend API (no extra npm dependency — plain fetch)
 * If RESEND_API_KEY is not set, logs to console instead (dev mode).
 */

interface SendEmailOptions {
  to:      string
  subject: string
  html:    string
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? "noreply@botflows.com.br"

  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — would send to ${opts.to}: ${opts.subject}`)
    return
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[email] Resend error ${res.status}: ${body}`)
  }
}

export function buildPortalAccessEmail(opts: {
  customerName: string
  email:        string
  password:     string
  productName:  string
  appUrl:       string
}): string {
  const { customerName, email, password, productName, appUrl } = opts
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 32px">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700">Acesso liberado ✅</p>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:13px">Seu pagamento foi confirmado</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">
              Olá, <strong>${customerName}</strong>!
            </p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
              Seu pagamento de <strong>${productName}</strong> foi aprovado.
              Aqui estão suas credenciais de acesso ao portal:
            </p>

            <!-- Credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:24px">
              <tr>
                <td style="padding:20px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-bottom:12px;border-bottom:1px solid #e5e7eb">
                        <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">E-mail</p>
                        <p style="margin:4px 0 0;color:#111827;font-size:14px;font-weight:500">${email}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:12px">
                        <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Senha</p>
                        <p style="margin:4px 0 0;color:#111827;font-size:18px;font-weight:700;letter-spacing:.1em;font-family:monospace">${password}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${appUrl}/assinaturas/login"
                    style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600">
                    Acessar minha área →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center">
              Você pode trocar sua senha a qualquer momento no portal.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
            <p style="margin:0;color:#9ca3af;font-size:12px">
              Este e-mail foi enviado automaticamente. Não responda.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildPurchaseConfirmationEmail(opts: {
  customerName: string
  productName:  string
  appUrl:       string
}): string {
  const { customerName, productName, appUrl } = opts
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <tr>
          <td style="background:#111827;padding:28px 32px">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700">Pagamento confirmado ✅</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Olá, <strong>${customerName}</strong>!</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
              Seu pagamento de <strong>${productName}</strong> foi confirmado.
              Acesse o portal para gerenciar suas assinaturas.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${appUrl}/assinaturas"
                    style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600">
                    Acessar portal →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
