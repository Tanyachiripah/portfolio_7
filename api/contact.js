const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { RESEND_API_KEY, RESEND_FROM_EMAIL, CONTACT_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !CONTACT_EMAIL) {
    console.error("Contact form is missing Resend environment configuration.");
    return res.status(500).json({ error: "The contact form is not configured yet." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid request body." });
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const { name, email, message } = body;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof message !== "string"
  ) {
    return res.status(400).json({ error: "Please provide your name, email, and message." });
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();
  if (
    !trimmedName ||
    trimmedName.length > 100 ||
    /\d/.test(trimmedName) ||
    trimmedEmail.length > 254 ||
    !emailPattern.test(trimmedEmail) ||
    !trimmedMessage ||
    trimmedMessage.length > 5000
  ) {
    return res.status(400).json({ error: "Please check the name, email, and message fields." });
  }

  let resendResponse;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [CONTACT_EMAIL],
        reply_to: trimmedEmail,
        subject: `Portfolio contact from ${trimmedName}`,
        text: `Name: ${trimmedName}\nEmail: ${trimmedEmail}\n\n${trimmedMessage}`,
      }),
    });
  } catch (error) {
    console.error("Unable to reach Resend:", error);
    return res.status(502).json({ error: "Unable to send your message right now. Please try again." });
  }

  if (!resendResponse.ok) {
    const errorDetails = await resendResponse.text();
    console.error("Resend rejected the contact email:", resendResponse.status, errorDetails);
    return res.status(502).json({ error: "Your message couldn't be sent. Please try again later." });
  }

  return res.status(200).json({ success: true });
};
