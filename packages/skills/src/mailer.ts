import nodemailer from 'nodemailer';

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER ?? '',
        pass: process.env.BREVO_SMTP_KEY ?? '',
      },
    });
  }
  return _transport;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const from = process.env.PLATFORM_FROM_EMAIL;
  if (!from || !process.env.BREVO_SMTP_KEY) {
    process.stdout.write('[mailer] BREVO_SMTP_KEY or PLATFORM_FROM_EMAIL not set, skipping email\n');
    return;
  }
  const info = await getTransport().sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });
  process.stdout.write(`[mailer] sent: ${JSON.stringify(info.messageId)}\n`);
}
