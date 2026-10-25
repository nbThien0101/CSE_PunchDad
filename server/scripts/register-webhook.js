require('dotenv').config();
const { confirmWebhook } = require('../src/services/payos.service');

async function main() {
  const webhookUrl = process.argv[2] || process.env.PAYOS_WEBHOOK_URL || 'https://cse-punchdad-api.onrender.com/api/payments/payos-webhook';
  console.log(`📡 Đang gửi yêu cầu đăng ký Webhook URL tới PayOS: ${webhookUrl}`);
  try {
    const result = await confirmWebhook(webhookUrl);
    console.log('✅ Đăng ký Webhook thành công với PayOS!');
    console.log('Chi tiết phản hồi từ PayOS:', result);
  } catch (err) {
    console.error('❌ Đăng ký Webhook thất bại:', err.message);
    console.log('\nGợi ý khắc phục:');
    console.log('1. Đảm bảo server backend Render đang chạy và có thể truy cập được từ internet.');
    console.log('2. Đảm bảo các biến PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong server/.env chính xác.');
  }
}

main();
