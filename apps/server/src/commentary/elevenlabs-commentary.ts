import type { CommentarySettings } from './commentary.service.js';

export const speechModels = {
  fast: 'eleven_flash_v2_5',
  expressive: 'eleven_v3',
} as const;

export type VoiceDelivery = keyof typeof speechModels;
export type VoiceCue = 'warmly' | 'excited' | 'playfully' | 'curious';

export interface VoiceReport {
  status: 'generated' | 'browser' | 'voice_unconfigured' | 'rejected' | 'timeout' | 'unavailable';
  model?: typeof speechModels[VoiceDelivery];
  httpStatus?: number;
}

type VoiceSettings = Pick<CommentarySettings, 'language' | 'accent' | 'voiceStyle' | 'voiceProvider' | 'voiceDelivery'>;

function voiceId(settings: VoiceSettings): string | undefined {
  const slot = settings.voiceStyle === 'licensed' ? 'LICENSED'
    : settings.language.toUpperCase() + '_' + (settings.accent === 'us' ? 'US' : 'IN');
  return process.env['COMMENTARY_ELEVEN_VOICE_' + slot]?.trim();
}

export function cloudVoiceConfigured(settings: VoiceSettings): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && voiceId(settings));
}

export async function synthesizeCommentarySpeech(line: string, settings: VoiceSettings, cue: VoiceCue): Promise<VoiceReport & {audio?: Buffer}> {
  if (settings.voiceProvider === 'browser') return {status: 'browser'};
  const model = speechModels[settings.voiceDelivery];
  const voice = voiceId(settings), key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!voice || !key) return {status: 'voice_unconfigured', model};

  const expressive = settings.voiceDelivery === 'expressive';
  // Only the app's cue can act as an audio tag. Text from names and Gemini is spoken as plain text.
  const text = expressive ? `[${cue}] ${line.replace(/[\[\]［］]/g, '')}` : line;
  const signal = AbortSignal.timeout(8000);
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice) + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: {'xi-api-key': key, 'content-type': 'application/json'},
      body: JSON.stringify({text, model_id: model, language_code: settings.language, ...(expressive && {voice_settings: {stability: 0.5}})}),
      signal,
    });
    if (!response.ok) return {status: 'rejected', model, httpStatus: response.status};
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!mimeType?.startsWith('audio/') && mimeType !== 'application/octet-stream') return {status: 'unavailable', model};
    const audio = Buffer.from(await response.arrayBuffer());
    return audio.length && audio.length <= 512_000 ? {status: 'generated', model, audio} : {status: 'unavailable', model};
  } catch {
    return {status: signal.aborted ? 'timeout' : 'unavailable', model};
  }
}
