import prisma from '../../lib/prisma';
import { env } from '../../config/env';

// Expo Push API
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Create a notification in the database
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data || {},
    },
  });

  // Send push notification if user has a push token
  await sendPushNotification(input.userId, input.title, input.body, input.data);

  return notification;
}

/**
 * Send a push notification via Expo
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { push_token: true, notifications_enabled: true },
    });

    if (!user || !user.push_token || !user.notifications_enabled) {
      console.log('[Notification] Skipping push - no token or notifications disabled');
      return;
    }

    const message = {
      to: user.push_token,
      sound: 'default',
      title,
      body,
      data: data || {},
      badge: 1,
    };

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if ((result as any).errors) {
      console.error('[Notification] Expo push error:', (result as any).errors);
    } else {
      console.log('[Notification] Push sent successfully to user:', userId);
    }
  } catch (error) {
    console.error('[Notification] Failed to send push notification:', error);
  }
}

/**
 * Register or update a user's Expo push token
 */
export async function registerPushToken(userId: string, pushToken: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { push_token: pushToken },
    select: { id: true, push_token: true },
  });

  console.log('[Notification] Push token registered for user:', userId);
  return user;
}

/**
 * Clear a user's push token
 */
export async function clearPushToken(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { push_token: null },
    select: { id: true },
  });

  console.log('[Notification] Push token cleared for user:', userId);
  return user;
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(userId: string, limit = 50) {
  const notifications = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return notifications.map((n: any) => ({
    id: n.id,
    user_id: n.user_id,
    type: n.type,
    title: n.title,
    body: n.body,
    is_read: n.is_read,
    data: n.data,
    created_at: n.created_at.toISOString(),
  }));
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      user_id: userId,
    },
    data: { is_read: true },
  });

  return notification;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      user_id: userId,
      is_read: false,
    },
    data: { is_read: true },
  });

  return result;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: {
      user_id: userId,
      is_read: false,
    },
  });

  return count;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  const notification = await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      user_id: userId,
    },
  });

  return notification;
}
