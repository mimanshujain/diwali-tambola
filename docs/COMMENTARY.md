# Tambola live commentary

The default text model is [Google Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). The TV can read Hindi and English commentary with its built-in speech voices. [ElevenLabs Flash v2.5](https://elevenlabs.io/docs/overview/capabilities/text-to-speech) is optional for cloud speech. See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing/) and [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) for provider charges.

In **Live AI commentary**, enable narration per game. Choose English or Hindi,
number frequency, shout-out focus and an interval of 1–30 calls (0 to turn off), commentary tone, winner announcements, voice source,
US or Indian accent, and family mode. Player progress comes only from approved,
submitted ticket numbers and called numbers. Shout-outs say how many numbers have matched and use the latest match or remaining numbers to suggest suspense or encouragement. Number call phrasing varies even without a provider key. Confirmed winners come from saved
winner records. The room TV shows captions even when sound is off; press **Sound**
on the TV to hear the voice. Its local **Narration** switch can silence it.

## Test commentary in the host console

1. Open a game and expand **Live AI commentary**. Choose language, tone, audience, accent, and voice. You can preview with **Enable commentary** switched off.
2. Under **Test commentary**, choose a sample event and click **Generate preview**. A successful request shows the model and a separate **Gemini reaction**. **Scripted fallback** explains why a reaction was unavailable, such as a missing or rejected key, an unavailable model, quota, a timeout, or a filtered response.
3. Play the sample on your current device. Browser playback uses that device's voices, which can differ from the TV's. Cloud speech uses the selected ElevenLabs voice and falls back to browser speech if it fails.
4. To test mild innuendo, enable **Allow mild sexual references (adults only)** and accept the confirmation. Pick a sample event, then generate again. Gemini can still filter a response. Re-enable **Family friendly** to return to the default.

Previews use fictional player and game data with your unsaved settings. They stay in the host console. The server allows up to ten previews per minute per host on each instance. Use **Save commentary** when you’re ready to apply the settings.

During play, **Refresh live status** shows which provider contributed to the last saved announcement. Announcements made before diagnostics were added show their source as unavailable.

## Set up the providers

Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` on the API server. This is enough for AI text. Select **TV browser voice** to read it aloud without a second API key. Set the optional `GEMINI_MODEL` to a Gemini text model ID from your project if you want to change it. A blank override uses `gemini-3.5-flash-lite`.

The app announces the called number, ticket progress or winner from saved game data. Gemini writes a short reaction using the event type, number and hit counts. Player names stay out of Gemini requests. If Gemini is unavailable or exceeds the 5.5-second timeout, the app uses its scripted announcement.

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
  and add the keys in the dashboard later. To override the default model, add
  `GEMINI_MODEL` in the web service's **Environment** settings and redeploy.

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
provider bills the server owner for eligible live and preview requests.
A game has a hard cap of 240 narration events, and reloading or opening another
TV reuses persisted events and audio. Provider calls occur after the draw is
committed and never delay the draw. Failed calls fall back to local speech; game
progress and commentary settings survive server restarts.

Family friendly is on by default, with no sexual references. An adults-only
switch allows mild, non-explicit innuendo about the game after confirmation.
Both settings use Gemini safety filters and the app's text checks. Names are
approved by the host, but generated text and accent quality still deserve a
short rehearsal with your chosen voice before guests arrive. A featured
celebrity voice requires a properly licensed voice ID; the app does not clone
or imitate a person from recordings.
