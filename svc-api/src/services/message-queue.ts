import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';

class MessageQueueService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ...');
      
      this.connection = await amqp.connect(config.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Declare queues
      await this.channel.assertQueue('leads', { durable: true });
      await this.channel.assertQueue('notifications', { durable: true });
      await this.channel.assertQueue('analytics', { durable: true });
      
      logger.info('Connected to RabbitMQ successfully');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      logger.info('Disconnected from RabbitMQ');
    } catch (error) {
      logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  async publishToQueue(queueName: string, message: any): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('Message queue not connected');
      }
      
      const messageBuffer = Buffer.from(JSON.stringify(message));
      this.channel.sendToQueue(queueName, messageBuffer, { persistent: true });
      
      logger.debug(`Message published to queue: ${queueName}`, { message });
    } catch (error) {
      logger.error(`Failed to publish message to queue ${queueName}:`, error);
      throw error;
    }
  }

  async consumeFromQueue(queueName: string, callback: (message: any) => void): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('Message queue not connected');
      }
      
      await this.channel.consume(queueName, (message: ConsumeMessage | null) => {
        if (message) {
          try {
            const content = JSON.parse(message.content.toString());
            callback(content);
            this.channel?.ack(message);
          } catch (error) {
            logger.error(`Error processing message from queue ${queueName}:`, error);
            this.channel?.nack(message, false, false);
          }
        }
      });
      
      logger.info(`Started consuming from queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to start consuming from queue ${queueName}:`, error);
      throw error;
    }
  }
}

export const messageQueueService = new MessageQueueService();
