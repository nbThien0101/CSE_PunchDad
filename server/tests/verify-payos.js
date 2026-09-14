require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { getPayOS, generateOrderCode, createPaymentLink } = require('../src/services/payos.service');
const { handlePayOSWebhook } = require('../src/controllers/payment.controller');

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Bắt đầu kiểm tra hệ thống tích hợp VietQR PayOS...\n');
  let testSessionId = null;
  let testPaymentId = null;

  try {
    // 1. Kiểm tra khởi tạo PayOS instance
    const payos = getPayOS();
    if (!payos) {
      throw new Error('Không thể khởi tạo PayOS instance. Vui lòng kiểm tra .env!');
    }
    console.log('✅ [1/5] Khởi tạo PayOS SDK thành công');

    // 2. Tạo trận đấu & payment mẫu trong database
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const member = await prisma.user.findFirst({ where: { role: 'MEMBER' } });

    if (!admin || !member) {
      throw new Error('Cần ít nhất 1 admin và 1 member trong DB để test');
    }

    const session = await prisma.session.create({
      data: {
        title: 'Trận Test PayOS ' + Date.now(),
        playDate: new Date(),
        startTime: '18:00',
        endTime: '20:00',
        location: 'Sân Test',
        minPlayers: 4,
        maxPlayers: 10,
        totalCost: 100000,
        status: 'BOOKED',
        createdById: admin.id,
        payerId: admin.id,
      },
    });
    testSessionId = session.id;

    const payment = await prisma.payment.create({
      data: {
        sessionId: session.id,
        userId: member.id,
        amount: 50000,
        status: 'PENDING',
      },
    });
    testPaymentId = payment.id;
    console.log(`✅ [2/5] Tạo session & payment mẫu thành công (Payment ID: ${payment.id})`);

    // 3. Test gọi PayOS API sinh link thanh toán thật
    const orderCode = generateOrderCode();
    const linkRes = await createPaymentLink({
      orderCode,
      amount: Number(payment.amount),
      description: 'CSE Test PayOS',
      returnUrl: 'http://localhost:5173',
      cancelUrl: 'http://localhost:5173',
    });

    if (!linkRes || !linkRes.checkoutUrl) {
      throw new Error('PayOS không trả về checkoutUrl');
    }

    // Cập nhật payment với orderCode
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        orderCode: BigInt(orderCode),
        checkoutUrl: linkRes.checkoutUrl,
        paymentLinkId: linkRes.paymentLinkId,
      },
    });
    console.log(`✅ [3/5] Tạo link VietQR PayOS thành công: ${linkRes.checkoutUrl}`);

    // 4. Test Webhook: Tạo payload có chữ ký hợp lệ từ PayOS Checksum Key
    const webhookData = {
      orderCode,
      amount: Number(payment.amount),
      description: 'CSE Test PayOS',
      accountNumber: linkRes.accountNumber || 'VQRQAMAEF7474',
      reference: 'TEST_' + Date.now(),
      transactionDateTime: new Date().toISOString(),
      currency: 'VND',
      paymentLinkId: linkRes.paymentLinkId,
      code: '00',
      desc: 'Thành công',
    };

    // Tạo chữ ký hợp lệ bằng SDK PayOS
    const signature = await payos.crypto.createSignatureFromObj(webhookData, process.env.PAYOS_CHECKSUM_KEY);

    const mockReq = {
      body: {
        code: '00',
        desc: 'success',
        data: webhookData,
        signature,
      },
    };

    let webhookResponseStatus = null;
    let webhookResponseBody = null;
    const mockRes = {
      status: (st) => {
        webhookResponseStatus = st;
        return {
          json: (body) => { webhookResponseBody = body; },
        };
      },
      json: (body) => {
        webhookResponseBody = body;
      },
    };

    await handlePayOSWebhook(mockReq, mockRes);
    console.log('Webhook Handler result:', webhookResponseBody);

    // Kiểm tra Payment trong DB xem đã CONFIRMED chưa
    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (updatedPayment.status !== 'CONFIRMED') {
      throw new Error(`Kỳ vọng payment status = CONFIRMED, nhưng nhận được: ${updatedPayment.status}`);
    }
    console.log('✅ [4/5] Xử lý Webhook thành công -> Payment tự động chuyển sang CONFIRMED!');

    // 5. Kiểm tra tự động hoàn thành trận đấu (Session status COMPLETED)
    const updatedSession = await prisma.session.findUnique({ where: { id: session.id } });
    if (updatedSession.status !== 'COMPLETED') {
      throw new Error(`Kỳ vọng session status = COMPLETED, nhưng nhận được: ${updatedSession.status}`);
    }
    console.log('✅ [5/5] Tất cả khoản thu đã hoàn tất -> Session tự động chuyển sang COMPLETED!');

    console.log('\n🎉 TẤT CẢ 5/5 BƯỚC KIỂM TRA PAYOS ĐỀU HOÀN TOÀN CHÍNH XÁC VÀ ĐẠT CHUẨN 100%!\n');
  } catch (error) {
    console.error('❌ Kiểm tra PayOS thất bại:', error);
    process.exit(1);
  } finally {
    // Dọn dẹp dữ liệu test
    if (testSessionId) {
      await prisma.payment.deleteMany({ where: { sessionId: testSessionId } }).catch(() => {});
      await prisma.session.delete({ where: { id: testSessionId } }).catch(() => {});
      console.log('🧹 Dọn dẹp dữ liệu test hoàn tất.');
    }
    await prisma.$disconnect();
  }
}

runTests();
