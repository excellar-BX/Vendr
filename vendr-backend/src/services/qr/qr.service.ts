import prisma from '../../lib/prisma';
import crypto from 'crypto';

/**
 * Generate QR codes for an order (pickup and delivery)
 * QR codes are unique tokens that expire after a set time
 */
export async function generateOrderQrCodes(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: true },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.order_type !== 'delivery') {
    throw new Error('QR codes are only for delivery orders');
  }

  // Generate unique tokens
  // 6 digits so the seller can read it out and the runner can type it
  const pickupToken = String(crypto.randomInt(100000, 1000000));
  const deliveryToken = crypto.randomBytes(16).toString('hex');

  // QR codes expire in 24 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Update order with QR codes
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      pickup_qr: pickupToken,
      delivery_qr: deliveryToken,
      qr_expires_at: expiresAt,
    },
  });

  return {
    pickup_qr: pickupToken,
    delivery_qr: deliveryToken,
    expires_at: expiresAt,
  };
}

/**
 * Validate a QR code token
 */
export async function validateQrToken(orderId: string, token: string, type: 'pickup' | 'delivery') {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Check if QR expired
  if (order.qr_expires_at && order.qr_expires_at < new Date()) {
    throw new Error('QR code has expired');
  }

  // Validate token
  const validToken = type === 'pickup' ? order.pickup_qr : order.delivery_qr;
  if (validToken !== token) {
    throw new Error('Invalid QR code');
  }

  return true;
}

/**
 * Get QR codes for an order (for seller/buyer to display)
 * Only returns the QR relevant to the user role
 */
export async function getOrderQrCodes(orderId: string, userId: string, role: 'seller' | 'buyer') {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Only the order's own seller/buyer may read its code (it was readable by anyone with the id)
  if (role === 'seller' && order.vendor_user_id !== userId) throw { statusCode: 403, message: 'Not your order' };
  if (role === 'buyer' && order.buyer_id !== userId) throw { statusCode: 403, message: 'Not your order' };

  // Return only the relevant code based on role (paid orders' codes don't expire before delivery)
  if (role === 'seller') {
    return {
      qr_code: order.pickup_qr,
      type: 'pickup',
      expires_at: order.qr_expires_at,
    };
  } else if (role === 'buyer') {
    return {
      qr_code: order.delivery_qr,
      type: 'delivery',
      expires_at: order.qr_expires_at,
    };
  }

  throw new Error('Invalid role');
}
