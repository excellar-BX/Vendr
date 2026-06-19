import prisma from '../../lib/prisma';

/**
 * Get analytics summary for a vendor
 * Returns aggregated data for different time periods
 */
export async function getVendorAnalytics(vendorId: string, period: 'day' | 'week' | 'month' | 'all' = 'all') {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' };
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'all':
    default:
      startDate = new Date(0); // Beginning of time
  }

  // Get analytics data for the period
  const analytics = await prisma.vendorAnalytics.findMany({
    where: {
      vendor_id: vendorId,
      date: {
        gte: startDate,
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Aggregate the data
  const summary = analytics.reduce(
    (acc, curr) => ({
      profile_views: acc.profile_views + curr.profile_views,
      product_views: acc.product_views + curr.product_views,
      inquiries: acc.inquiries + curr.inquiries,
      revenue: acc.revenue + Number(curr.revenue), // ← Number() handles Prisma Decimal
      orders_count: acc.orders_count + curr.orders_count,
      unique_visitors: acc.unique_visitors + curr.unique_visitors,
    }),
    {
      profile_views: 0,
      product_views: 0,
      inquiries: 0,
      revenue: 0,
      orders_count: 0,
      unique_visitors: 0,
    }
  );

  // Calculate derived metrics
  const avg_order_value = summary.orders_count > 0 ? summary.revenue / summary.orders_count : 0;
  const conversion_rate = summary.unique_visitors > 0 ? (summary.orders_count / summary.unique_visitors) * 100 : 0;

  // Calculate repeat customers (customers with > 1 order)
  // This requires querying order data - for now, estimate based on orders vs visitors
  const repeat_customers = Math.max(0, Math.floor(summary.orders_count * 0.15)); // 15% estimate

  // Calculate growth metrics (compare with previous period)
  const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
  const previousAnalytics = await prisma.vendorAnalytics.findMany({
    where: {
      vendor_id: vendorId,
      date: {
        gte: previousStartDate,
        lt: startDate,
      },
    },
  });

  const previousSummary = previousAnalytics.reduce(
    (acc, curr) => ({
      revenue: acc.revenue + Number(curr.revenue),
      orders_count: acc.orders_count + curr.orders_count,
      unique_visitors: acc.unique_visitors + curr.unique_visitors,
    }),
    {
      revenue: 0,
      orders_count: 0,
      unique_visitors: 0,
    }
  );

  const revenue_growth = previousSummary.revenue > 0
    ? ((summary.revenue - previousSummary.revenue) / previousSummary.revenue) * 100
    : 0;
  const orders_growth = previousSummary.orders_count > 0
    ? ((summary.orders_count - previousSummary.orders_count) / previousSummary.orders_count) * 100
    : 0;
  const visitors_growth = previousSummary.unique_visitors > 0
    ? ((summary.unique_visitors - previousSummary.unique_visitors) / previousSummary.unique_visitors) * 100
    : 0;

  // Add calculated fields to summary
  const enhancedSummary = {
    ...summary,
    avg_order_value,
    conversion_rate,
    repeat_customers,
    revenue_growth,
    orders_growth,
    visitors_growth,
  };

  // Get daily data for charts (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyData = await prisma.vendorAnalytics.findMany({
    where: {
      vendor_id: vendorId,
      date: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Get top performing products
  const productAnalytics = await prisma.productAnalytics.groupBy({
    by: ['product_id'],
    where: {
      vendor_id: vendorId,
      date: {
        gte: startDate,
      },
    },
    _sum: {
      views: true,
      orders_count: true,
      revenue: true,
    },
    orderBy: {
      _sum: {
        revenue: 'desc',
      },
    },
    take: 5,
  });

  // Get product details for top products
  const productIds = productAnalytics.map((p) => p.product_id);
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
    select: {
      id: true,
      name: true,
      price: true,
      image_url: true,
    },
  });

  const topProducts = productAnalytics.map((pa) => {
    const product = products.find((p) => p.id === pa.product_id);
    const views = pa._sum.views || 0;
    const orders = pa._sum.orders_count || 0;
    const conversionRate = views > 0 ? (orders / views) * 100 : 0;
    return {
      product_id: pa.product_id,
      product_name: product?.name || 'Unknown',
      product_price: Number(product?.price) || 0,
      product_image: product?.image_url,
      views: views,
      orders_count: orders,
      revenue: Number(pa._sum.revenue) || 0,
      conversion_rate: conversionRate,
    };
  });

  // Format daily data dates to short day names (Mon, Tue, etc.)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const formattedDailyData = dailyData.map((d) => ({
    date: dayNames[d.date.getDay()],
    profile_views: d.profile_views,
    product_views: d.product_views,
    inquiries: d.inquiries,
    revenue: Number(d.revenue),
    orders_count: d.orders_count,
  }));

  return {
    summary: enhancedSummary,
    daily_data: formattedDailyData,
    top_products: topProducts,
    period,
  };
}

/**
 * Record a profile view for a vendor
 */
export async function recordProfileView(vendorId: string, userId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if analytics entry exists for today
  const existing = await prisma.vendorAnalytics.findUnique({
    where: {
      vendor_id_date: {
        vendor_id: vendorId,
        date: today,
      },
    },
  });

  if (existing) {
    // Update existing entry
    await prisma.vendorAnalytics.update({
      where: {
        vendor_id_date: {
          vendor_id: vendorId,
          date: today,
        },
      },
      data: {
        profile_views: {
          increment: 1,
        },
        unique_visitors: userId
          ? {
              increment: 1,
            }
          : undefined,
      },
    });
  } else {
    // Create new entry
    await prisma.vendorAnalytics.create({
      data: {
        vendor_id: vendorId,
        date: today,
        profile_views: 1,
        unique_visitors: userId ? 1 : 0,
      },
    });
  }

  return { success: true };
}

/**
 * Record a product view
 */
export async function recordProductView(productId: string, vendorId: string, userId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update vendor analytics
  const existingVendorAnalytics = await prisma.vendorAnalytics.findUnique({
    where: {
      vendor_id_date: {
        vendor_id: vendorId,
        date: today,
      },
    },
  });

  if (existingVendorAnalytics) {
    await prisma.vendorAnalytics.update({
      where: {
        vendor_id_date: {
          vendor_id: vendorId,
          date: today,
        },
      },
      data: {
        product_views: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.vendorAnalytics.create({
      data: {
        vendor_id: vendorId,
        date: today,
        product_views: 1,
      },
    });
  }

  // Update product analytics
  const existingProductAnalytics = await prisma.productAnalytics.findUnique({
    where: {
      product_id_date: {
        product_id: productId,
        date: today,
      },
    },
  });

  if (existingProductAnalytics) {
    await prisma.productAnalytics.update({
      where: {
        product_id_date: {
          product_id: productId,
          date: today,
        },
      },
      data: {
        views: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.productAnalytics.create({
      data: {
        product_id: productId,
        vendor_id: vendorId,
        date: today,
        views: 1,
      },
    });
  }

  return { success: true };
}

/**
 * Record an inquiry (conversation started)
 */
export async function recordInquiry(vendorId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.vendorAnalytics.findUnique({
    where: {
      vendor_id_date: {
        vendor_id: vendorId,
        date: today,
      },
    },
  });

  if (existing) {
    await prisma.vendorAnalytics.update({
      where: {
        vendor_id_date: {
          vendor_id: vendorId,
          date: today,
        },
      },
      data: {
        inquiries: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.vendorAnalytics.create({
      data: {
        vendor_id: vendorId,
        date: today,
        inquiries: 1,
      },
    });
  }

  return { success: true };
}

/**
 * Record an order (revenue and order count)
 */
export async function recordOrder(vendorId: string, productId: string, amount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update vendor analytics
  const existingVendorAnalytics = await prisma.vendorAnalytics.findUnique({
    where: {
      vendor_id_date: {
        vendor_id: vendorId,
        date: today,
      },
    },
  });

  if (existingVendorAnalytics) {
    await prisma.vendorAnalytics.update({
      where: {
        vendor_id_date: {
          vendor_id: vendorId,
          date: today,
        },
      },
      data: {
        revenue: {
          increment: amount,
        },
        orders_count: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.vendorAnalytics.create({
      data: {
        vendor_id: vendorId,
        date: today,
        revenue: amount,
        orders_count: 1,
      },
    });
  }

  // Update product analytics
  const existingProductAnalytics = await prisma.productAnalytics.findUnique({
    where: {
      product_id_date: {
        product_id: productId,
        date: today,
      },
    },
  });

  if (existingProductAnalytics) {
    await prisma.productAnalytics.update({
      where: {
        product_id_date: {
          product_id: productId,
          date: today,
        },
      },
      data: {
        revenue: {
          increment: amount,
        },
        orders_count: {
          increment: 1,
        },
      },
    });
  } else {
    await prisma.productAnalytics.create({
      data: {
        product_id: productId,
        vendor_id: vendorId,
        date: today,
        revenue: amount,
        orders_count: 1,
      },
    });
  }

  return { success: true };
}

/**
 * Get product-specific analytics
 */
export async function getProductAnalytics(vendorId: string, productId: string, period: 'day' | 'week' | 'month' | 'all' = 'all') {
  const product = await prisma.product.findUnique({
    where: { id: productId, vendor_id: vendorId },
  });

  if (!product) {
    throw { statusCode: 404, message: 'Product not found' };
  }

  // Calculate date range
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'all':
    default:
      startDate = new Date(0);
  }

  const analytics = await prisma.productAnalytics.findMany({
    where: {
      product_id: productId,
      vendor_id: vendorId,
      date: {
        gte: startDate,
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  const summary = analytics.reduce(
    (acc, curr) => ({
      views: acc.views + curr.views,
      orders_count: acc.orders_count + curr.orders_count,
      revenue: acc.revenue + curr.revenue,
    }),
    {
      views: 0,
      orders_count: 0,
      revenue: 0,
    }
  );

  // Get daily data for charts
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyData = await prisma.productAnalytics.findMany({
    where: {
      product_id: productId,
      vendor_id: vendorId,
      date: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  return {
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
    },
    summary,
    daily_data: dailyData.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      views: d.views,
      orders_count: d.orders_count,
      revenue: d.revenue,
    })),
    period,
  };
}
