import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/app-config";

type WelcomeEmailInput = {
  to: string;
};

function getAppUrl(): string | null {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  if (!appUrl) return null;
  return appUrl.replace(/\/+$/, "");
}

function getMailConfig() {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM;

  if (!host || !portValue || !user || !pass || !from) {
    return null;
  }

  const port = Number(portValue);
  if (!Number.isFinite(port)) {
    return null;
  }

  return { host, port, user, pass, from };
}

function createWelcomeEmail({ to }: WelcomeEmailInput) {
  const appUrl = getAppUrl();
  const subject = `Velkommen til ${APP_NAME}`;
  const intro = `Velkommen til ${APP_NAME}.`;
  const bodyLines = [
    intro,
    "",
    `${APP_NAME} hjælper dig med at få en løbeplan, der passer til dit niveau, dine mål og din hverdag, og som justerer sig undervejs, når du giver feedback.`,
    "",
    "Næste skridt:",
    "1. Åbn appen og færdiggør din løbeprofil.",
    "2. Generér din første plan.",
    "3. Log kort feedback efter hvert træningspas, så coachen kan lære dig bedre at kende.",
  ];

  if (appUrl) {
    bodyLines.push("", `Åbn ${APP_NAME}: ${appUrl}`);
  }

  bodyLines.push("", "God træning,", `${APP_NAME}-teamet`);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #14212b; line-height: 1.6;">
      <h1 style="margin-bottom: 12px;">Velkommen til ${APP_NAME}</h1>
      <p style="margin: 0 0 12px;">Du er nu klar til at komme i gang.</p>
      <p style="margin: 0 0 16px;">
        ${APP_NAME} hjælper dig med en personlig løbeplan, som passer til dit niveau, dine mål og din hverdag,
        og som justerer sig undervejs, når du giver feedback.
      </p>
      <p style="margin: 0 0 8px; font-weight: 700;">Næste skridt</p>
      <ol style="padding-left: 20px; margin: 0 0 16px;">
        <li>Åbn appen og færdiggør din løbeprofil.</li>
        <li>Generér din første plan.</li>
        <li>Log kort feedback efter hvert træningspas, så coachen kan lære dig bedre at kende.</li>
      </ol>
      ${appUrl ? `<p style="margin: 0 0 16px;"><a href="${appUrl}" style="color: #1580aa; font-weight: 700;">Gå til ${APP_NAME}</a></p>` : ""}
      <p style="margin: 0;">God træning,<br />${APP_NAME}-teamet</p>
    </div>
  `.trim();

  return { to, subject, text: bodyLines.join("\n"), html };
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const config = getMailConfig();
  if (!config) {
    return { sent: false as const, skipped: true as const, reason: "missing_config" as const };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const message = createWelcomeEmail(input);

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return { sent: true as const, skipped: false as const };
}
