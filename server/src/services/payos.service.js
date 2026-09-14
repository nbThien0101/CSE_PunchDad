const { PayOS } = require('@payos/node');

/**
 * Khởi tạo PayOS Client
 */
let payosInstance = null;

const getPayOS = () => {
  if (!payosInstance) {
    const clientId = (process.env.PAYOS_CLIENT_ID || '').trim();
    const apiKey = (process.env.PAYOS_API_KEY || '').trim();
    const checksumKey = (process.env.PAYOS_CHECKSUM_KEY || '').trim();

    if (!clientId || !apiKey || !checksumKey) {
      console.warn('⚠️ PayOS configuration is missing (PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY).');
      return null;
    }

    payosInstance = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
  }
  return payosInstance;
};

/**
 * Tạo mã orderCode duy nhất dạng số nguyên
 * (PayOS yêu cầu orderCode phải là số nguyên dương <= Number.MAX_SAFE_INTEGER)
 */
const generateOrderCode = () => {
  // 13 chữ số timestamp + 2 chữ số ngẫu nhiên = 15 chữ số < 9007199254740991 (16 chữ số)
  const timestamp = Date.now();
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  return Number(`${timestamp}${randomSuffix}`);
};

/**
 * Chuẩn hóa mô tả chuyển khoản (tối đa 25 ký tự, không dấu, không ký tự đặc biệt)
 */
const sanitizeDescription = (text) => {
  const base = text || 'Tien san';
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25);
};

/**
 * Tạo link thanh toán VietQR qua PayOS
 * @param {Object} params
 * @param {number} params.orderCode
 * @param {number} params.amount
 * @param {string} params.description
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 */
const createPaymentLink = async ({ orderCode, amount, description, returnUrl, cancelUrl }) => {
  const payos = getPayOS();
  if (!payos) {
    throw new Error('Cổng thanh toán PayOS chưa được cấu hình đầy đủ API Keys.');
  }

  const cleanAmount = Math.round(Number(amount));
  if (!cleanAmount || cleanAmount <= 0) {
    throw new Error('Số tiền thanh toán không hợp lệ.');
  }

  const cleanDescription = sanitizeDescription(description);

  const payload = {
    orderCode,
    amount: cleanAmount,
    description: cleanDescription,
    returnUrl,
    cancelUrl,
  };

  const paymentLinkResponse = await payos.paymentRequests.create(payload);
  return paymentLinkResponse;
};

/**
 * Xác thực dữ liệu Webhook gửi từ PayOS
 * @param {Object} webhookBody
 */
const verifyWebhookData = async (webhookBody) => {
  const payos = getPayOS();
  if (!payos) {
    throw new Error('Cổng thanh toán PayOS chưa được cấu hình.');
  }

  return await payos.webhooks.verify(webhookBody);
};

/**
 * Lấy thông tin thanh toán từ PayOS theo orderCode
 * @param {number} orderCode
 */
const getPaymentLinkInformation = async (orderCode) => {
  const payos = getPayOS();
  if (!payos) {
    throw new Error('Cổng thanh toán PayOS chưa được cấu hình.');
  }

  return await payos.paymentRequests.get(orderCode);
};

module.exports = {
  getPayOS,
  generateOrderCode,
  sanitizeDescription,
  createPaymentLink,
  verifyWebhookData,
  getPaymentLinkInformation,
};
