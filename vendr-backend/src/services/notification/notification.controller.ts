import { FastifyRequest, FastifyReply } from 'fastify';
import * as NotificationService from './notification.service';

/**
 * Get all notifications for the current user
 */
export async function getNotificationsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const limit = parseInt((request.query as { limit?: string }).limit || '50', 10);

    const notifications = await NotificationService.getUserNotifications(userId, limit);

    return reply.status(200).send({
      success: true,
      data: notifications,
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to fetch notifications',
    });
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCountController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;

    const count = await NotificationService.getUnreadCount(userId);

    return reply.status(200).send({
      success: true,
      data: { count },
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to fetch unread count',
    });
  }
}

/**
 * Mark a notification as read
 */
export async function markAsReadController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    await NotificationService.markNotificationAsRead(id, userId);

    return reply.status(200).send({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to mark notification as read',
    });
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsReadController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;

    const result = await NotificationService.markAllNotificationsAsRead(userId);

    return reply.status(200).send({
      success: true,
      message: 'All notifications marked as read',
      data: { count: result.count },
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to mark all notifications as read',
    });
  }
}

/**
 * Delete a notification
 */
export async function deleteNotificationController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    await NotificationService.deleteNotification(id, userId);

    return reply.status(200).send({
      success: true,
      message: 'Notification deleted',
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to delete notification',
    });
  }
}

/**
 * Register Expo push token
 */
export async function registerPushTokenController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { pushToken } = request.body as { pushToken: string };

    if (!pushToken) {
      return reply.status(400).send({
        success: false,
        message: 'pushToken is required',
      });
    }

    const user = await NotificationService.registerPushToken(userId, pushToken);

    return reply.status(200).send({
      success: true,
      message: 'Push token registered',
      data: { push_token: user.push_token },
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to register push token',
    });
  }
}

/**
 * Clear push token
 */
export async function clearPushTokenController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;

    await NotificationService.clearPushToken(userId);

    return reply.status(200).send({
      success: true,
      message: 'Push token cleared',
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message || 'Failed to clear push token',
    });
  }
}

/**
 * Test endpoint for push notifications (no auth required for testing)
 */
export async function testPushNotificationController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { userId, title, body, type } = request.body as {
      userId: string;
      title: string;
      body: string;
      type?: string;
    };

    if (!userId || !title || !body) {
      return reply.status(400).send({
        success: false,
        message: 'userId, title, and body are required',
      });
    }

    await NotificationService.sendPushNotification(userId, title, body, type || 'test');

    return reply.status(200).send({
      success: true,
      message: 'Test notification sent',
    });
  } catch (err: any) {
    return reply.status(500).send({
      success: false,
      message: err.message || 'Failed to send test notification',
    });
  }
}
