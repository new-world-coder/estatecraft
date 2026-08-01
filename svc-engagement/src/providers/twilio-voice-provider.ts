import {
  IVoiceProvider,
  InitiateCallParams,
  CallResult,
  CallStatusResult,
  SendSmsParams,
  SmsResult,
  CommunicationStatus,
} from '@estatecraft/shared';

/**
 * Twilio provider stub — implements IVoiceProvider for future integration.
 * Replace stub methods with Twilio SDK calls when credentials are configured.
 */
export class TwilioVoiceProvider implements IVoiceProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber?: string
  ) {}

  async listNumbers(): Promise<Array<{ id: string; number: string }>> {
    if (this.fromNumber) {
      return [{ id: 'twilio-default', number: this.fromNumber }];
    }
    throw new Error('Twilio provider not fully configured. Set TWILIO_PHONE_NUMBER.');
  }

  async initiateCall(_params: InitiateCallParams): Promise<CallResult> {
    throw new Error(
      'Twilio voice provider is a stub. Install twilio SDK and implement initiateCall, or use Dial provider.'
    );
  }

  async getCallStatus(callId: string): Promise<CallStatusResult> {
    return { callId, status: CommunicationStatus.PENDING };
  }

  async sendSms(_params: SendSmsParams): Promise<SmsResult> {
    throw new Error('Twilio SMS provider is a stub. Implement sendSms or use Dial provider.');
  }
}
