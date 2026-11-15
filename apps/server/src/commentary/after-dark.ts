import type { CommentarySettings } from './commentary.service.js';
import { configuredVoiceProfile } from './voice-profiles.js';

export function afterDarkEnabled(settings: CommentarySettings): boolean {
  return !settings.familyFriendly && settings.allowSexualReferences && settings.innuendoIntensity === 4;
}

// Keep the innuendo on the game pieces. Only the factual announcement uses player names.
const punchlines = {
  en: {
    NUMBER: [
      'The board wanted a slow tease. That ball came early and ruined the buildup.',
      'The drum likes it slow. A little suspense makes the whole room lean in.',
      'The ticket said to take it slow. The drum heard shake it harder.',
      'The board asked for another round. The drum said it was just warming up.',
    ],
    SHOUTOUT: [
      'That ticket likes a little foreplay. One mark at a time keeps it interesting.',
      'The ticket and the dabber said they were just friends. The ink says otherwise.',
      'The board likes being teased. The ticket is taking that a little too seriously.',
      'The marks keep getting closer. The ticket insists it needs personal space.',
    ],
    WINNER: [
      'The board asked if it was good for the ticket, too.',
      'The full ticket said it could go another round. The dabber needed a minute.',
      'That ticket likes to finish first. The others are still catching their breath.',
      'The drum took a bow. It has been working on that big finish all night.',
    ],
  },
  hi: {
    NUMBER: [
      'बोर्ड बोला, ज़रा धीरे। मज़ा आने लगा था कि अगला नंबर निकल गया।',
      'टिकट ने कहा, धीरे-धीरे। ड्रम ने सुना, और ज़ोर से हिलाओ।',
      'बोर्ड को थोड़ा तड़पाना था। ये गेंद तो वक्त से पहले ही निकल गई।',
      'बोर्ड ने पूछा, एक और राउंड? ड्रम बोला, मैं तो अभी गरम हुआ हूँ।',
    ],
    SHOUTOUT: [
      'टिकट और मार्कर बोले, बस दोस्त हैं। स्याही कुछ और ही कहती है।',
      'टिकट को छेड़ने में मज़ा है। सारे निशान एक साथ लगाकर क्या जल्दी है?',
      'निशान पास आते जा रहे हैं। टिकट कहता है, थोड़ी दूरी तो रखो।',
      'बोर्ड को इंतज़ार में मज़ा आता है। टिकट ने बात कुछ ज़्यादा ही मान ली।',
    ],
    WINNER: [
      'बोर्ड ने टिकट से पूछा, तुम्हें भी उतना ही मज़ा आया?',
      'टिकट बोला, एक राउंड और हो जाए। मार्कर बोला, ज़रा साँस तो लेने दो।',
      'इस टिकट को पहले खत्म करने का शौक है। बाकी टिकट अभी साँस ले रहे हैं।',
      'ड्रम ने सलाम किया। इस अंजाम की तैयारी पूरी रात से चल रही थी।',
    ],
  },
  haryanvi: {
    NUMBER: [
      'बोर्ड बोल्या, तनै इतनी भी के जल्दी सै? मज़ा इब शुरू होया था।',
      'टिकट बोल्या, धीरे-धीरे। ड्रम ने सुण्या, और जोर तै हिला।',
      'बोर्ड ने सोच्या थोड़ा तड़पावां। गेंद तो टैम तै पहले निकल ली।',
      'बोर्ड बोल्या, एक चक्कर और? ड्रम बोल्या, इब तो गरम होया सूं।',
    ],
    SHOUTOUT: [
      'टिकट और मार्कर बोलें, बस दोस्त सां। स्याही कती औरै बात बतावै सै।',
      'टिकट नै छेड़ण में मज़ा सै। सारे निशान एक साथ लगाण की के जल्दी सै?',
      'निशान पास आवैं सैं। टिकट बोल्या, थोड़ी दूर भी रह ले।',
      'बोर्ड नै इंतज़ार में मज़ा आवै सै। टिकट बात नै कुछ ज्यादा मान गया।',
    ],
    WINNER: [
      'बोर्ड ने टिकट तै पूछ्या, तन्नै भी उतना ई मज़ा आया?',
      'टिकट बोल्या, एक चक्कर और हो जा। मार्कर बोल्या, साँस तो लेण दे।',
      'इस टिकट नै पहले निबटाण का शौक सै। बाकी इब भी साँस भर रहे सैं।',
      'ड्रम बोल्या, यो आखिरी दाँव सारी रात तै तैयार कर राख्या था।',
    ],
  },
} as const;

export function afterDarkPunchline(settings: CommentarySettings, event: 'NUMBER' | 'SHOUTOUT' | 'WINNER', index: number): string {
  const dialect = configuredVoiceProfile(settings.voiceProfile, settings.language)?.dialect;
  const lines = punchlines[dialect ?? settings.language][event];
  return lines[index % lines.length];
}
