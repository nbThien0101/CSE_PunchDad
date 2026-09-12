const nodemailer = require('nodemailer');

/**
 * Gửi email qua Brevo HTTP REST API (port 443 HTTPS - không bao giờ bị Render/Cloud chặn)
 */
const sendViaBrevo = async (email, otp, htmlContent) => {
  const apiKey = (process.env.BREVO_API_KEY || '').replace(/^["']|["']$/g, '').trim();
  const senderEmail = (process.env.SMTP_EMAIL || 'csepunchdad@gmail.com').replace(/^["']|["']$/g, '').trim();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: 'CSE PunchDad ⚽',
        email: senderEmail,
      },
      to: [
        {
          email: email,
        },
      ],
      subject: `[CSE PunchDad] Mã xác thực OTP: ${otp}`,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ Brevo API error:', errorData);
    throw new Error(errorData.message || `Lỗi khi gửi email qua Brevo (${response.status})`);
  }

  const result = await response.json();
  console.log('✅ Email OTP sent successfully via Brevo:', result.messageId);
  return result;
};

/**
 * Cấu hình Nodemailer transporter (Fallback cho Gmail SMTP)
 * Sử dụng Gmail SMTP với App Password
 */
const createTransporter = () => {
  // Strip quotes from env values (common issue when copy-pasting to hosting)
  const smtpEmail = (process.env.SMTP_EMAIL || '').replace(/^["']|["']$/g, '').trim();
  const smtpPassword = (process.env.SMTP_PASSWORD || '').replace(/^["']|["']$/g, '').trim();

  if (!smtpEmail || !smtpPassword) {
    console.error('❌ SMTP config missing:', {
      SMTP_EMAIL: smtpEmail ? '✅ set' : '❌ MISSING',
      SMTP_PASSWORD: smtpPassword ? '✅ set' : '❌ MISSING',
    });
    throw new Error('Cấu hình gửi email chưa đầy đủ (thiếu BREVO_API_KEY hoặc SMTP_EMAIL/SMTP_PASSWORD)');
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpEmail,
      pass: smtpPassword,
    },
  });
};

/**
 * Kiểm tra kết nối SMTP
 */
const verifyTransporter = async (transporter) => {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('❌ SMTP verify failed:', error.message);
    return false;
  }
};

/**
 * Gửi email OTP xác thực
 * @param {string} email - Email người nhận
 * @param {string} otp - Mã OTP 6 số
 */
const sendOTPEmail = async (email, otp) => {
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

  const brevoApiKey = (process.env.BREVO_API_KEY || '').replace(/^["']|["']$/g, '').trim();

  // Ưu tiên 1: Gửi qua Brevo HTTPS API (an toàn, không bị Render/Cloud chặn port)
  if (brevoApiKey) {
    return await sendViaBrevo(email, otp, htmlContent);
  }

  // Ưu tiên 2: Fallback qua Nodemailer SMTP nếu không có BREVO_API_KEY
  const transporter = createTransporter();
  const smtpEmail = (process.env.SMTP_EMAIL || '').replace(/^["']|["']$/g, '').trim();

  const mailOptions = {
    from: `"CSE PunchDad ⚽" <${smtpEmail}>`,
    to: email,
    subject: `[CSE PunchDad] Mã xác thực OTP: ${otp}`,
    html: htmlContent,
  };

  const isVerified = await verifyTransporter(transporter);
  if (!isVerified) {
    throw new Error('Không thể kết nối đến máy chủ gửi email. Vui lòng kiểm tra cấu hình SMTP hoặc BREVO_API_KEY.');
  }

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };

