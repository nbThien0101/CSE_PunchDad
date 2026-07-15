const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
          select: { id: true, displayName: true, bankInfo: true, phone: true },
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
          select: { id: true, displayName: true },
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

    // Kiểm tra tất cả payments đã confirmed → session COMPLETED
    const pendingPayments = await prisma.payment.count({
      where: {
        sessionId: payment.sessionId,
        status: { not: 'CONFIRMED' },
      },
    });

    if (pendingPayments === 0) {
      await prisma.session.update({
        where: { id: payment.sessionId },
        data: { status: 'COMPLETED' },
      });

      return res.json({
        message: 'Payment confirmed! All payments completed - session marked as COMPLETED',
        payment: updated,
        sessionCompleted: true,
      });
    }

    res.json({ message: 'Payment confirmed', payment: updated, sessionCompleted: false });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSessionPayments, markAsPaid, confirmPayment };
