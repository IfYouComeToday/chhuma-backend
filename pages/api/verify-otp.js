export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

  // Check if the OTP matches
  if (global.otpStore && global.otpStore[email] == otp) {
    delete global.otpStore[email]; // Remove OTP after successful verification
    return res.json({ success: true, message: "OTP Verified" });
  }

  return res.status(400).json({ error: "Invalid OTP" });
}
