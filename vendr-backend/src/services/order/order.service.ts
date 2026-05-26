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
