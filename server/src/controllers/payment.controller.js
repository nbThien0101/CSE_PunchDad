const { PrismaClient } = require('@prisma/client');
const payosService = require('../services/payos.service');

const prisma = new PrismaClient();

/**
 * Kiểm tra xem tất cả payments của session đã CONFIRMED chưa.
 * Nếu đã hoàn tất, tự động chuyển session sang COMPLETED.
 */
const checkAndCompleteSession = async (sessionId) => {
  const pendingCount = await prisma.payment.count({
    where: {
      sessionId,
      status: { not: 'CONFIRMED' },
    },
  });

  if (pendingCount === 0) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    });
    return true;
  }
  return false;
};

/**
 * GET /api/payments/session/:sessionId
 * Lấy danh sách payments của một session
 */
const getSessionPayments = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        totalCost: true,
        status: true,
        payer: {
          select: { id: true, displayName: true, bankInfo: true, phone: true, avatar: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const payments = await prisma.payment.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
      orderBy: { status: 'asc' },
    });

    const summary = {
      totalCost: session.totalCost,
      pending: payments.filter(p => p.status === 'PENDING').length,
      paid: payments.filter(p => p.status === 'PAID').length,
      confirmed: payments.filter(p => p.status === 'CONFIRMED').length,
      total: payments.length,
    };

    res.json({ session, payments, summary });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/payments/:id/mark-paid
 * User đánh dấu đã chuyển tiền
 */
const markAsPaid = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Chỉ user sở hữu payment mới được đánh dấu đã chuyển
    if (payment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only mark your own payment' });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    res.json({ message: 'Payment marked as paid', payment: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/payments/:id/confirm
 * Người thanh toán (payer) hoặc Admin xác nhận đã nhận tiền
 */
const confirmPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        session: {
          select: { payerId: true },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Chỉ payer của session hoặc admin mới confirm được
    const isPayer = payment.session.payerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isPayer && !isAdmin) {
      return res.status(403).json({ error: 'Only the payer or admin can confirm payments' });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    const sessionCompleted = await checkAndCompleteSession(payment.sessionId);

    res.json({
      message: sessionCompleted
        ? 'Payment confirmed! All payments completed - session marked as COMPLETED'
        : 'Payment confirmed',
      payment: updated,
      sessionCompleted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/:id/payos-link
 * Tạo link và mã VietQR thanh toán PayOS cho payment
 */
const createPayOSLink = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true } },
        session: { select: { id: true, title: true, playDate: true } },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy khoản thanh toán' });
    }

    // Chỉ user sở hữu payment hoặc Admin mới được tạo link
    if (payment.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Bạn không có quyền thanh toán cho khoản này' });
    }

    if (payment.status === 'CONFIRMED') {
      return res.status(400).json({ error: 'Khoản thanh toán này đã được xác nhận hoàn tất' });
    }

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    const returnUrl = `${clientUrl}/sessions/${payment.sessionId}?payment_status=success`;
    const cancelUrl = `${clientUrl}/sessions/${payment.sessionId}?payment_status=cancelled`;

    // Nếu đã có orderCode trước đó, thử lấy thông tin link hiện tại
    if (payment.orderCode) {
      try {
        const existingInfo = await payosService.getPaymentLinkInformation(Number(payment.orderCode));
        if (existingInfo) {
          if (existingInfo.status === 'PAID') {
            // Đã trả tiền rồi -> cập nhật CONFIRMED ngay
            const updated = await prisma.payment.update({
              where: { id },
              data: {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
              },
            });
            await checkAndCompleteSession(payment.sessionId);
            return res.json({
              status: 'CONFIRMED',
              message: 'Khoản thanh toán đã hoàn tất!',
              payment: updated,
            });
          }

          if (existingInfo.status === 'PENDING') {
            // Vẫn đang chờ thanh toán -> trả về QR & link cũ
            return res.json({
              payment,
              orderCode: Number(payment.orderCode),
              checkoutUrl: payment.checkoutUrl || existingInfo.checkoutUrl,
              qrCode: existingInfo.qrCode,
              amount: existingInfo.amount,
              description: existingInfo.description,
              accountName: existingInfo.accountName,
              accountNumber: existingInfo.accountNumber,
              bin: existingInfo.bin,
            });
          }
        }
      } catch (checkErr) {
        console.warn('Could not reuse existing PayOS link, creating new one:', checkErr.message);
      }
    }

    // Tạo orderCode mới duy nhất
    const newOrderCode = payosService.generateOrderCode();
    const description = `CSE ${payment.user?.displayName || 'Tien san'}`;

    const linkResponse = await payosService.createPaymentLink({
      orderCode: newOrderCode,
      amount: Number(payment.amount),
      description,
      returnUrl,
      cancelUrl,
    });

    // Cập nhật payment trong DB
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        orderCode: BigInt(newOrderCode),
        checkoutUrl: linkResponse.checkoutUrl,
        paymentLinkId: linkResponse.paymentLinkId,
      },
    });

    res.json({
      payment: updatedPayment,
      orderCode: newOrderCode,
      checkoutUrl: linkResponse.checkoutUrl,
      qrCode: linkResponse.qrCode,
      amount: linkResponse.amount,
      description: linkResponse.description,
      accountName: linkResponse.accountName,
      accountNumber: linkResponse.accountNumber,
      bin: linkResponse.bin,
    });
  } catch (error) {
    console.error('Create PayOS Link error:', error);
    res.status(400).json({ error: error.message || 'Không thể tạo link thanh toán PayOS' });
  }
};

/**
 * POST /api/payments/payos-webhook
 * Nhận Webhook từ PayOS khi có giao dịch chuyển khoản thành công
 * (Route này PUBLIC, không có JWT middleware, xác thực bằng checksum signature của PayOS)
 */
const handlePayOSWebhook = async (req, res) => {
  try {
    const webhookBody = req.body;

    // Xác thực chữ ký Webhook
    let webhookData;
    try {
      webhookData = await payosService.verifyWebhookData(webhookBody);
    } catch (verifyErr) {
      console.error('❌ PayOS Webhook Signature Verification Failed:', verifyErr.message);
      return res.status(400).json({ error: 'Chữ ký webhook không hợp lệ' });
    }

    console.log('🔔 PayOS Webhook received:', {
      orderCode: webhookData.orderCode,
      amount: webhookData.amount,
      code: webhookData.code,
      desc: webhookData.desc,
    });

    // code === '00' là giao dịch thành công
    if (webhookData.code === '00') {
      const orderCodeNum = Number(webhookData.orderCode);

      const payment = await prisma.payment.findFirst({
        where: {
          orderCode: BigInt(orderCodeNum),
        },
      });

      if (!payment) {
        console.warn(`⚠️ Payment with orderCode ${orderCodeNum} not found in database.`);
        // Vẫn trả về 200 để PayOS không retry liên tục
        return res.json({ success: true, message: 'Order code not found' });
      }

      if (payment.status !== 'CONFIRMED') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CONFIRMED',
            paidAt: payment.paidAt || new Date(),
            confirmedAt: new Date(),
          },
        });

        console.log(`✅ Payment ${payment.id} auto-CONFIRMED via PayOS Webhook!`);

        // Kiểm tra xem tất cả payments của session đã xong chưa
        const sessionCompleted = await checkAndCompleteSession(payment.sessionId);
        if (sessionCompleted) {
          console.log(`🎉 Session ${payment.sessionId} COMPLETED! All members have paid.`);
        }
      }
    }

    return res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('PayOS Webhook Handler Error:', error);
    // Trả về 200 để PayOS ghi nhận đã nhận request
    return res.status(200).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/payments/:id/payos-status
 * Cho phép Client polling kiểm tra trạng thái thanh toán PayOS theo thời gian thực
 */
const checkPayOSStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true } },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy khoản thanh toán' });
    }

    // Nếu đã CONFIRMED trong DB
    if (payment.status === 'CONFIRMED') {
      return res.json({
        status: 'CONFIRMED',
        payment,
        isPaid: true,
      });
    }

    // Nếu có orderCode, kiểm tra trực tiếp với PayOS API
    if (payment.orderCode) {
      try {
        const info = await payosService.getPaymentLinkInformation(Number(payment.orderCode));
        if (info && info.status === 'PAID') {
          const updated = await prisma.payment.update({
            where: { id },
            data: {
              status: 'CONFIRMED',
              paidAt: payment.paidAt || new Date(),
              confirmedAt: new Date(),
            },
          });

          await checkAndCompleteSession(payment.sessionId);

          return res.json({
            status: 'CONFIRMED',
            payment: updated,
            isPaid: true,
          });
        }

        return res.json({
          status: payment.status,
          payosStatus: info.status,
          payment,
          isPaid: false,
        });
      } catch (err) {
        console.warn('PayOS check status error:', err.message);
      }
    }

    res.json({
      status: payment.status,
      payment,
      isPaid: payment.status === 'CONFIRMED',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSessionPayments,
  markAsPaid,
  confirmPayment,
  createPayOSLink,
  handlePayOSWebhook,
  checkPayOSStatus,
};
