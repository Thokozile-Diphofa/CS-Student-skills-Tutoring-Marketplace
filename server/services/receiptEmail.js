const nodemailer = require("nodemailer");

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    const error = new Error("Receipt email SMTP configuration is incomplete.");
    error.code = "SMTP_CONFIG_MISSING";
    throw error;
  }

  return { host, port, user, password, from };
}

function formatReceiptDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg"
  }).format(date);
}

async function sendPaymentReceiptEmail(receipt) {
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { minVersion: "TLSv1.2" }
  });

  const sessionDate = formatReceiptDate(receipt.sessionDate);
  const paymentDate = formatReceiptDate(receipt.paymentDate);
  const amount = `${receipt.currency} ${receipt.amount}`;

  return transporter.sendMail({
    from: config.from,
    to: receipt.studentEmail,
    subject: `EasyLearning payment receipt ${receipt.receiptNumber}`,
    text: [
      "EasyLearning",
      "Tutoring Marketplace payment confirmation",
      "",
      `Receipt number: ${receipt.receiptNumber}`,
      `Payment date: ${paymentDate}`,
      `Student: ${receipt.studentName}`,
      `Tutor: ${receipt.tutorName}`,
      `Subject: ${receipt.subject}`,
      `Session date: ${sessionDate}`,
      `Amount paid: ${amount}`,
      "Payment status: PAID",
      `Payment reference: ${receipt.paymentReference}`,
      "",
      `View or print your receipt after signing in: ${receipt.receiptUrl}`,
      "",
      "Thank you for using EasyLearning."
    ].join("\n")
  });
}

module.exports = { sendPaymentReceiptEmail };
