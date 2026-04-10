import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import * as NotificationController from './notification.controller';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get all notifications
  fastify.get('/notifications', {
    preHandler: authenticate,
  }, NotificationController.getNotificationsController);

  // Get unread count
  fastify.get('/notifications/unread-count', {
    preHandler: authenticate,
  }, NotificationController.getUnreadCountController);

  // Mark notification as read
  fastify.patch('/notifications/:id/read', {
    preHandler: authenticate,
  }, NotificationController.markAsReadController);

  // Mark all notifications as read
  fastify.patch('/notifications/read-all', {
    preHandler: authenticate,
  }, NotificationController.markAllAsReadController);

  // Delete notification
  fastify.delete('/notifications/:id', {
    preHandler: authenticate,
  }, NotificationController.deleteNotificationController);

  // Register push token
  fastify.post('/notifications/register-token', {
    preHandler: authenticate,
  }, NotificationController.registerPushTokenController);

  // Clear push token
  fastify.delete('/notifications/clear-token', {
    preHandler: authenticate,
  }, NotificationController.clearPushTokenController);
}
