declare module 'amqplib' {
  export interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }
  export interface Channel {
    assertQueue(queue: string, options?: object): Promise<unknown>;
    sendToQueue(queue: string, content: Buffer, options?: object): boolean;
    consume(queue: string, callback: (msg: ConsumeMessage | null) => void): Promise<unknown>;
    ack(message: ConsumeMessage): void;
    nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
    close(): Promise<void>;
  }
  export interface ConsumeMessage {
    content: Buffer;
  }
  function connect(url: string): Promise<Connection>;
  export default { connect };
}
