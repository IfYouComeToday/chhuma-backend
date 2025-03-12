import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  // Store OTP in memory (temporary, should use a database in production)
  global.otpStore = global.otpStore || {};
  global.otpStore[email] = otp;

  // Email configuration (replace with your own credentials)
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: "sayandsinha@gmail.com",  // Replace with your email
      pass: "yhrh vtlx xavx ohvb",   // Replace with your email password
    },
  });

  const mailOptions = {
    from: "Chhuma <your-email@gmail.com>",
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}. It expires in 5 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP" });
  }
}
