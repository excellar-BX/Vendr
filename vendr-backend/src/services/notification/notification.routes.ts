import { FastifyInstance } from 'fastify';
import * as NotificationController from './notification.controller';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get all notifications
  fastify.get('/notifications', {
    preHandler: [fastify.authenticate],
  }, NotificationController.getNotificationsController);

  // Get unread count
  fastify.get('/notifications/unread-count', {
    preHandler: [fastify.authenticate],
  }, NotificationController.getUnreadCountController);

  // Mark notification as read
  fastify.patch('/notifications/:id/read', {
    preHandler: [fastify.authenticate],
  }, NotificationController.markAsReadController);

  // Mark all notifications as read
  fastify.patch('/notifications/read-all', {
    preHandler: [fastify.authenticate],
  }, NotificationController.markAllAsReadController);

  // Delete notification
  fastify.delete('/notifications/:id', {
    preHandler: [fastify.authenticate],
  }, NotificationController.deleteNotificationController);

  // Register push token
  fastify.post('/notifications/register-token', {
    preHandler: [fastify.authenticate],
  }, NotificationController.registerPushTokenController);

  // Clear push token
  fastify.delete('/notifications/clear-token', {
    preHandler: [fastify.authenticate],
  }, NotificationController.clearPushTokenController);
}
