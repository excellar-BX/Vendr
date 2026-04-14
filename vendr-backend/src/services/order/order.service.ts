import prisma from '../../lib/prisma'

export interface OrderOutput {
  id: string
  amount: number
  description: string | null
  status: string
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

/**
 * Get orders where user is the buyer
 */
export async function getBoughtOrders(userId: string): Promise<OrderOutput[]> {
  const orders = await prisma.order.findMany({
    where: { buyer_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      vendor: {
        select: {
          shop_name: true
        }
      }
    }
  })

  return orders.map(order => ({
    id: order.id,
    amount: order.amount,
    description: order.description,
    status: order.status,
    escrow_status: order.escrow_status,
    created_at: order.created_at.toISOString(),
    buyer_id: order.buyer_id,
    vendor_id: order.vendor_id,
    conversation_id: order.conversation_id,
    vendor_name: order.vendor?.shop_name ?? 'Unknown Vendor'
  }))
}

/**
 * Get orders where user is the vendor (sold)
 */
export async function getSoldOrders(userId: string): Promise<OrderOutput[]> {
  const orders = await prisma.order.findMany({
    where: { vendor_user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      buyer: {
        select: {
          full_name: true
        }
      }
    }
  })

  return orders.map(order => ({
    id: order.id,
    amount: order.amount,
    description: order.description,
    status: order.status,
    created_at: order.created_at.toISOString(),
    buyer_id: order.buyer_id,
    vendor_id: order.vendor_id,
    conversation_id: order.conversation_id,
    buyer_name: order.buyer?.full_name ?? 'Anonymous'
  }))
}

/**
 * Get order statistics for user
 */
export async function getOrdersStats(userId: string): Promise<OrdersStats> {
  const [boughtCount, soldCount] = await Promise.all([
    prisma.order.count({
      where: { buyer_id: userId }
    }),
    prisma.order.count({
      where: { vendor_user_id: userId }
    })
  ])

  return {
    bought: boughtCount,
    sold: soldCount
  }
}
