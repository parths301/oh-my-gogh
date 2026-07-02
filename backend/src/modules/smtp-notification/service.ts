import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import { Logger, ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types"
import nodemailer, { Transporter } from "nodemailer"

type SmtpOptions = {
  host: string
  port: number
  secure: boolean
  user?: string
  password?: string
  from: string
}

type InjectedDependencies = { logger: Logger }

// Plain SMTP email provider so the store isn't tied to any one email SaaS.
// Point SMTP_* env vars at Resend/Postmark/SES/Gmail — anything with SMTP.
class SmtpNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-smtp"
  protected logger_: Logger
  protected options_: SmtpOptions
  protected transporter_: Transporter

  constructor({ logger }: InjectedDependencies, options: SmtpOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.transporter_ = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
    })
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const data = (notification.data || {}) as Record<string, unknown>
    const subject = (data.subject as string) || "A note from the studio"
    const html = (data.html as string) || ""
    const text = (data.text as string) || ""

    const info = await this.transporter_.sendMail({
      from: this.options_.from,
      to: notification.to,
      subject,
      html: html || undefined,
      text: text || undefined,
    })
    this.logger_.info(`[smtp] sent "${subject}" to ${notification.to} (${info.messageId})`)
    return { id: info.messageId }
  }
}

export default SmtpNotificationProviderService
