const { EmailClient } = require("@azure/communication-email");

module.exports = async function (context, req) {
  if (req.method !== "POST") {
    context.res = { status: 405, body: { message: "Method not allowed" } };
    return;
  }

  const data = req.body;
  if (!data || !data.patientFirst || !data.patientLast || !data.providerName) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { message: "Please fill in all required fields." }
    };
    return;
  }

  if (!data.patientPhone && !data.patientEmail) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { message: "Please provide at least a phone number or email address for the patient." }
    };
    return;
  }

  const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
  const senderAddress = process.env.SENDER_EMAIL || "DoNotReply@rechargepsychiatry.com";

  const stateNames = {
    AZ: "Arizona", CO: "Colorado", CT: "Connecticut", IA: "Iowa", ID: "Idaho",
    IN: "Indiana", MD: "Maryland", ME: "Maine", NM: "New Mexico", NV: "Nevada",
    NY: "New York", OH: "Ohio", OR: "Oregon", UT: "Utah", WA: "Washington"
  };

  const stateLine = data.patientState ? (stateNames[data.patientState] || data.patientState) : "Not provided";

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#2E7D32;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:20px;">New Patient Referral</h2>
        <p style="color:#d4edda;margin:4px 0 0;font-size:13px;">Recharge Psychiatry</p>
      </div>
      <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <h3 style="color:#0F766E;margin:0 0 12px;font-size:16px;border-bottom:2px solid #E8F4F0;padding-bottom:8px;">Patient Information</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#475569;width:140px;">Name</td><td style="padding:6px 0;font-weight:600;">${escHtml(data.patientFirst)} ${escHtml(data.patientLast)}</td></tr>
          ${data.patientDob ? `<tr><td style="padding:6px 0;color:#475569;">Date of Birth</td><td style="padding:6px 0;">${escHtml(data.patientDob)}</td></tr>` : ""}
          ${data.patientPhone ? `<tr><td style="padding:6px 0;color:#475569;">Phone</td><td style="padding:6px 0;">${escHtml(data.patientPhone)}</td></tr>` : ""}
          ${data.patientEmail ? `<tr><td style="padding:6px 0;color:#475569;">Email</td><td style="padding:6px 0;">${escHtml(data.patientEmail)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#475569;">State</td><td style="padding:6px 0;">${escHtml(stateLine)}</td></tr>
        </table>
        ${data.referralReason ? `
        <h3 style="color:#0F766E;margin:20px 0 8px;font-size:16px;border-bottom:2px solid #E8F4F0;padding-bottom:8px;">Reason for Referral</h3>
        <p style="font-size:14px;color:#1B3A4B;white-space:pre-wrap;">${escHtml(data.referralReason)}</p>
        ` : ""}
        <h3 style="color:#0F766E;margin:20px 0 8px;font-size:16px;border-bottom:2px solid #E8F4F0;padding-bottom:8px;">Referring Provider</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#475569;width:140px;">Name</td><td style="padding:6px 0;font-weight:600;">${escHtml(data.providerName)}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#94a3b8;">Submitted ${new Date(data.submittedAt || Date.now()).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" })} ET</p>
      </div>
    </div>
  `;

  const subjectState = data.patientState ? ` (${stateNames[data.patientState] || data.patientState})` : "";
  const recipients = [
    { address: "info@rechargepsychiatry.com" },
    { address: "Carlos@rechargepsychiatry.com" },
    { address: "Isaiah@rechargepsychiatry.com" }
  ];

  try {
    const client = new EmailClient(connectionString);
    const message = {
      senderAddress: senderAddress,
      content: {
        subject: `New Referral: ${data.patientFirst} ${data.patientLast}${subjectState}`,
        html: emailHtml,
        plainText: `New Patient Referral\n\nPatient: ${data.patientFirst} ${data.patientLast}${data.patientDob ? "\nDOB: " + data.patientDob : ""}${data.patientPhone ? "\nPhone: " + data.patientPhone : ""}${data.patientEmail ? "\nEmail: " + data.patientEmail : ""}\nState: ${stateLine}\n${data.referralReason ? "Reason: " + data.referralReason + "\n" : ""}\nReferred by: ${data.providerName}`
      },
      recipients: { to: recipients }
    };

    const poller = await client.beginSend(message);
    await poller.pollUntilDone();

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { success: true, message: "Referral submitted successfully." }
    };
  } catch (err) {
    context.log.error("Email send failed:", err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { message: "We were unable to submit your referral at this time. Please call us at (419) 318-7515." }
    };
  }
};

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
