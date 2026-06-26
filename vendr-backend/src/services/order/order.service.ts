import prisma from '../../lib/prisma'

export interface OrderOutput {
  id: string
  amount: number
  description: string | null
  status: string
  escrow_status: string
  order_type: string
  delivery_address: string | null
  otp_confirmed: boolean
  buyer_confirmed_at: string | null
  otp_confirmed_at: string | null
  auto_release_at: string | null
  created_at: string
  buyer_id: string
  vendor_id: string
  conversation_id: string | null
  vendor_name?: string
  buyer_name?: string
}

export interface OrdersStats {
  bought: number
  sold: number
}

function mapOrderBase(order: {
  id: string
  amount: number
  description: string | null
  status: string
  escrow_status: string
  order_type: string
  delivery_address: string | null
  otp_confirmed: boolean
  buyer_confirmed_at: Date | null
  otp_confirmed_at: Date | null
  auto_release_at: Date | null
  created_at: Date
  buyer_id: string
  vendor_id: string
  conversation_id: string | null
}) {
  return {
    id: order.id,
    amount: order.amount,
    description: order.description,
    status: order.status,
    escrow_status: order.escrow_status,
    order_type: order.order_type,
    delivery_address: order.delivery_address,
    otp_confirmed: order.otp_confirmed,
    buyer_confirmed_at: order.buyer_confirmed_at?.toISOString() ?? null,
    otp_confirmed_at: order.otp_confirmed_at?.toISOString() ?? null,
    auto_release_at: order.auto_release_at?.toISOString() ?? null,
    created_at: order.created_at.toISOString(),
    buyer_id: order.buyer_id,
    vendor_id: order.vendor_id,
    conversation_id: order.conversation_id,
  }
}

export async function getBoughtOrders(userId: string): Promise<OrderOutput[]> {
  const orders = await prisma.order.findMany({
    where: { buyer_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      vendor: { select: { shop_name: true } },
    },
  })

  return orders.map((order) => ({
    ...mapOrderBase(order),
    vendor_name: order.vendor?.shop_name ?? 'Unknown Vendor',
  }))
}

export async function getSoldOrders(userId: string): Promise<OrderOutput[]> {
  const orders = await prisma.order.findMany({
    where: { vendor_user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      buyer: { select: { full_name: true } },
    },
  })

  return orders.map((order) => ({
    ...mapOrderBase(order),
    buyer_name: order.buyer?.full_name ?? 'Anonymous',
  }))
}

export async function getOrdersStats(userId: string): Promise<OrdersStats> {
  const [boughtCount, soldCount] = await Promise.all([
    prisma.order.count({ where: { buyer_id: userId } }),
    prisma.order.count({ where: { vendor_user_id: userId } }),
  ])

  return { bought: boughtCount, sold: soldCount }
}

export async function updateOrderStatus(orderId: string, vendorUserId: string, status: string): Promise<OrderOutput> {
  // Validate status transitions
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid order status')
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (!order) {
    throw new Error('Order not found')
  }

  if (order.vendor_user_id !== vendorUserId) {
    throw new Error('You do not have permission to update this order')
  }

  // Prevent invalid status transitions
  const currentStatus = order.status
  const allowedTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['delivered'],
    delivered: [],
    cancelled: [],
  }

  if (!allowedTransitions[currentStatus]?.includes(status)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${status}`)
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      vendor: { select: { shop_name: true } },
    },
  })

  return {
    ...mapOrderBase(updatedOrder),
    vendor_name: updatedOrder.vendor?.shop_name ?? 'Unknown Vendor',
  }
}

export async function confirmOrderReceipt(orderId: string, buyerId: string): Promise<OrderOutput> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (!order) {
    throw new Error('Order not found')
  }

  if (order.buyer_id !== buyerId) {
    throw new Error('You do not have permission to confirm this order')
  }

  if (order.status !== 'ready') {
    throw new Error('Order must be in "ready" status to confirm receipt')
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'delivered',
      buyer_confirmed_at: new Date(),
      delivery_confirmed_at: new Date(),
    },
    include: {
      vendor: { select: { shop_name: true } },
    },
  })

  return {
    ...mapOrderBase(updatedOrder),
    vendor_name: updatedOrder.vendor?.shop_name ?? 'Unknown Vendor',
  }
}
