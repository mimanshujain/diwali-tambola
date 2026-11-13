# Tambola live commentary

Recommended service combination: [Google Gemini 2.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite) for brief Hindi/English text, with [ElevenLabs Flash v2.5](https://elevenlabs.io/docs/overview/capabilities/text-to-speech) for optional consistent speech. The TV's built-in speech is the free baseline. See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing/) and [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) before enabling paid services.

In **Live AI commentary**, enable narration per game. Choose English or Hindi,
number frequency, shout-out focus and an interval of 1–30 calls (0 to turn off), commentary tone, winner announcements, voice source,
US or Indian accent, and family mode. Player progress comes only from approved,
submitted ticket numbers and called numbers. Shout-outs say how many numbers have matched and use the latest match or remaining numbers to suggest suspense or encouragement. Number call phrasing varies even without a provider key. Confirmed winners come from saved
winner records. The room TV shows captions even when sound is off; press **Sound**
on the TV to hear the voice. Its local **Narration** switch can silence it.

With no API keys, the system uses factual English/Hindi sentences and the TV's
built-in speech voices. The available accents depend on the TV's installed
voices. For AI phrasing, create an API key in
[Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY`
on the server. The small
`gemini-2.5-flash-lite` model adds a brief reaction to a factual sentence.
Prompts contain event type, number and hit counts, not player names; the app
adds approved names afterwards. Requests time out after four seconds and
fall back to the factual sentence. For consistent cloud speech, configure
`ELEVENLABS_API_KEY` plus voice IDs for the combinations offered to hosts:

- **Raspberry Pi:** if `.env` already exists, add the new lines to it; do not
  overwrite your existing database and admin credentials. Otherwise, copy
  `.env.example` to `.env`. Put the real provider values in `.env`,
  then recreate the API container with `sudo docker compose up -d --build api`.
  `compose.yaml` forwards the optional keys and voice IDs to the API. If you use
  `compose.public.yaml`, it inherits the same API environment.
- **Render:** `render.yaml` lists the keys and voice IDs as `sync: false` secret
  prompts when first creating the Blueprint. Render ignores newly added
  `sync: false` entries for an existing Blueprint, so add them in the web
  service's **Environment** settings instead and redeploy. The initial
  Blueprint form prompts for every listed secret: if you are not enabling
  commentary yet, remove its optional entries before creating the Blueprint
  and add the keys in the dashboard later.

Get the ElevenLabs API key from your ElevenLabs account and select voice IDs
from voices you can use in its voice library. Set `ELEVENLABS_API_KEY` and at
least the voice ID for each language/accent combination you plan to offer.
No client-side key is needed: both requests originate from the API server.

| Server environment variable | Used for |
| --- | --- |
| `COMMENTARY_ELEVEN_VOICE_EN_US` | English, US accent |
| `COMMENTARY_ELEVEN_VOICE_EN_IN` | English, Indian accent |
| `COMMENTARY_ELEVEN_VOICE_HI_IN` | Hindi, Indian accent |
| `COMMENTARY_ELEVEN_VOICE_HI_US` | Hindi, US accent, if a suitable voice is available |
| `COMMENTARY_ELEVEN_VOICE_LICENSED` | Optional featured voice, verified and licensed for this use |

Only configure voice IDs you have rights to use and that sound good in the
selected language. Select **Cloud voice** in the console after the server has
both the API key and the matching voice ID. An unconfigured combination is
rejected. Never expose the keys in the browser or repository.
Cloud speech sends the completed sentence, including any approved player name,
to ElevenLabs. Text generation does not send player names to Gemini. The
provider bills the server owner; set provider spending limits independently.
A game has a hard cap of 240 narration events, and reloading or opening another
TV reuses persisted events and audio. Provider calls occur after the draw is
committed and never delay the draw. Failed calls fall back to local speech; game
progress and commentary settings survive server restarts.

Family friendly is on by default, with no sexual references. An adults-only
switch allows mild, non-explicit innuendo after confirmation; explicit material
is still filtered. Use the family setting for mixed-age gatherings. Names are
approved by the host, but generated text and accent quality still deserve a
short rehearsal with your chosen voice before guests arrive. A featured
celebrity voice requires a properly licensed voice ID; the app does not clone
or imitate a person from recordings.
