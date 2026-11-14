import type { CommentarySettings } from './commentary.service.js';

const defaultModel = 'gemini-3.5-flash-lite';
const blockedReasons = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);
const safetyCategories = ['HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_DANGEROUS_CONTENT'];
const explicit = /\b(?:fuck\w*|shit\w*|porn\w*|nude|naked|rape\w*)\b|अश्लील|नग्न|शारीरिक संबंध|बलात्कार/i;
const sexual = /\b(?:sex\w*|kiss\w*|bedroom|hook[ -]?up|foreplay|turn[ -]on)\b|सेक्स|चुंबन|चुम्बन|चूम/i;

type Status = 'generated' | 'no_key' | 'invalid_model' | 'invalid_key' | 'access_denied' | 'model_unavailable' |
  'quota' | 'billing' | 'payment_required' | 'rejected' | 'unavailable' | 'timeout' | 'blocked' | 'truncated' | 'empty' | 'filtered';
export interface GeminiReport {
  status: Status;
  model: string | null;
  httpStatus?: number;
}

interface ReactionFacts {
  event: 'NUMBER' | 'WINNER' | 'SHOUTOUT';
  number?: number;
  calledOnTicket?: number;
  ticketSize?: number;
  latestCallMatched?: boolean;
  callIndex: number;
}

interface GeminiReply {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

export const geminiKey = (): string | undefined => process.env.GEMINI_API_KEY?.trim() || undefined;
function geminiModel(): string | null {
  const model = process.env.GEMINI_MODEL?.trim() || defaultModel;
  return model.length <= 80 && /^gemini-[a-z\d]+(?:[.-][a-z\d]+)*$/.test(model) ? model : null;
}

async function rejection(response: Response): Promise<Status> {
  switch (response.status) {
    case 400: {
      const body = await response.json().catch(() => null) as {error?:{status?:string;details?:{reason?:string}[]}} | null;
      const details = body?.error?.details;
      if (Array.isArray(details) && details.some(detail => detail?.reason === 'API_KEY_INVALID')) return 'invalid_key';
      return body?.error?.status === 'FAILED_PRECONDITION' ? 'billing' : 'rejected';
    }
    case 401: return 'invalid_key';
    case 402: return 'payment_required';
    case 403: return 'access_denied';
    case 404: return 'model_unavailable';
    case 429: return 'quota';
    default: return response.status >= 500 ? 'unavailable' : 'rejected';
  }
}

export async function generateReaction(
  facts: ReactionFacts,
  settings: Pick<CommentarySettings, 'language' | 'tone' | 'familyFriendly' | 'allowSexualReferences'>,
): Promise<{report: GeminiReport; reaction: string | null}> {
  const key = geminiKey(), model = geminiModel();
  const failure = (status: Status, httpStatus?: number) => ({report: {status, model, httpStatus}, reaction: null});
  if (!key) return failure('no_key');
  if (!model) return failure('invalid_model');

  const adult = !settings.familyFriendly && settings.allowSexualReferences;
  const audience = adult
    ? 'For an adults-only audience, use a mild, non-explicit double meaning about the game when it fits. Keep it about the game and never sexualize or tease a person. No explicit sexual content.'
    : settings.familyFriendly ? 'Keep the line suitable for children. No sexual references.' : 'No sexual references.';
  const prompt = `Write one original reaction for a Tambola host, at most 16 words, with a ${settings.tone} tone, ${settings.language === 'hi' ? 'in natural Hindi using Devanagari' : 'in natural English'}. A short factual announcement comes just before your line. React to this specific moment with a playful image, suspense, or encouragement. Avoid stock phrases like “check your ticket” or “great energy.” For ticket progress, suggest how the moment might feel without claiming to know the player's emotions. Keep the situation accurate. Do not repeat or invent facts, names, numbers, prizes, or wins. No digits, profanity, harassment, or stereotypes. ${audience} Return only the reaction on one line.\nGame facts: ${JSON.stringify(facts)}`;
  const safetySettings = safetyCategories.map(category => ({
    category,
    threshold: category === 'HARM_CATEGORY_SEXUALLY_EXPLICIT' && !adult ? 'BLOCK_LOW_AND_ABOVE' : 'BLOCK_MEDIUM_AND_ABOVE',
  }));

  const signal = AbortSignal.timeout(5_500);
  try {
    const reply = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {'x-goog-api-key': key, 'content-type': 'application/json'},
      body: JSON.stringify({contents: [{parts: [{text: prompt}]}], generationConfig: {temperature: 0.9, maxOutputTokens: 256}, safetySettings}),
      signal,
    });
    if (!reply.ok) {
      const status = await rejection(reply);
      return signal.aborted ? failure('timeout') : failure(status, reply.status);
    }

    const data = await reply.json().catch(() => null) as GeminiReply | null;
    if (signal.aborted) return failure('timeout');
    const candidate = data?.candidates?.[0], finish = candidate?.finishReason;
    if (data?.promptFeedback?.blockReason || (finish && blockedReasons.has(finish))) return failure('blocked');
    if (finish === 'MAX_TOKENS') return failure('truncated');
    if (finish && finish !== 'STOP') return failure('rejected');
    const parts = candidate?.content?.parts;
    const value = Array.isArray(parts) ? parts.map(part => !part?.thought && typeof part?.text === 'string' ? part.text : '').join('').trim() : '';
    if (!value) return failure('empty');

    const inHindi = /\p{Script=Devanagari}/u.test(value);
    if (value.length > 200 || /[\p{Nd}<>\r\n]/u.test(value) || explicit.test(value) || (!adult && sexual.test(value)) ||
      (settings.language === 'hi' ? !inHindi : inHindi || !/[a-z]/i.test(value))) return failure('filtered');
    return {report: {status: 'generated', model}, reaction: value};
  } catch {
    return failure(signal.aborted ? 'timeout' : 'unavailable');
  }
}
