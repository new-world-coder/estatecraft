import { IVoiceProvider } from '@estatecraft/shared';
import { DialVoiceProvider } from '../providers/dial-voice-provider';
import { MockVoiceProvider } from '../providers/mock-voice-provider';
import { TwilioVoiceProvider } from '../providers/twilio-voice-provider';
import { config } from '../config';

export type ProviderType = 'dial' | 'twilio' | 'mock';

export function createVoiceProvider(type?: ProviderType): IVoiceProvider {
  const providerType = type || config.voiceProvider;

  switch (providerType) {
    case 'dial':
      if (!config.dialApiKey) {
        console.warn('DIAL_API_KEY not set — falling back to mock provider');
        return new MockVoiceProvider();
      }
      return new DialVoiceProvider({
        apiKey: config.dialApiKey,
        baseUrl: config.dialBaseUrl,
        fromNumberId: config.dialFromNumberId,
      });
    case 'twilio':
      return new TwilioVoiceProvider(
        config.twilioAccountSid || '',
        config.twilioAuthToken || '',
        config.twilioPhoneNumber
      );
    case 'mock':
      return new MockVoiceProvider();
    default:
      return new MockVoiceProvider();
  }
}
