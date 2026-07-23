const nodemailer = require('nodemailer');

/**
 * Cấu hình Nodemailer transporter
 * Sử dụng Gmail SMTP với App Password
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

/**
 * Gửi email OTP xác thực
 * @param {string} email - Email người nhận
 * @param {string} otp - Mã OTP 6 số
 */
const sendOTPEmail = async (email, otp) => {
  const transporter = createTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 460px; border-collapse: collapse; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                  <div style="font-size: 2rem; margin-bottom: 8px;">⚽</div>
                  <h1 style="margin: 0; font-size: 1.3rem; font-weight: 800; color: #111827; letter-spacing: -0.02em;">CSE PunchDad</h1>
                  <p style="margin: 4px 0 0; font-size: 0.85rem; color: #6b7280;">Xác thực email đăng ký</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 16px; font-size: 0.95rem; color: #374151; line-height: 1.6;">
                    Xin chào! 👋
                  </p>
                  <p style="margin: 0 0 24px; font-size: 0.9rem; color: #4b5563; line-height: 1.6;">
                    Bạn đang đăng ký tài khoản CSE PunchDad. Vui lòng sử dụng mã OTP bên dưới để hoàn tất xác thực:
                  </p>
                  <!-- OTP Code -->
                  <div style="text-align: center; margin: 24px 0;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #3b5bff, #2541cc); border-radius: 12px; padding: 16px 32px; box-shadow: 0 4px 14px rgba(59, 91, 255, 0.3);">
                      <span style="font-size: 2rem; font-weight: 800; color: #ffffff; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>
                  </div>
                  <p style="margin: 24px 0 0; font-size: 0.82rem; color: #9ca3af; line-height: 1.6; text-align: center;">
                    ⏱️ Mã này sẽ hết hạn sau <strong style="color: #6b7280;">5 phút</strong>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px; background: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 0.75rem; color: #9ca3af; text-align: center; line-height: 1.5;">
                    Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.<br>
                    © ${new Date().getFullYear()} CSE PunchDad
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"CSE PunchDad ⚽" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: `[CSE PunchDad] Mã xác thực OTP: ${otp}`,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };
