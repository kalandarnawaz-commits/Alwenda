# ElevenLabs Translation Speech

Alwenda plays translated text aloud through a Supabase Edge Function so the ElevenLabs API key never reaches browser JavaScript.

## Endpoint

Recommended final function slug:

```text
elevenlabs-tts
```

Default frontend endpoint:

```text
{SUPABASE_URL}/functions/v1/elevenlabs-tts
```

The Supabase dashboard may currently show a deployed generated slug beginning with `clever-acti...`. That slug is not present in this repository, so the frontend centralizes the slug in `src/config.js` as `ELEVENLABS_TTS_FUNCTION_SLUG`. If production still uses the generated slug, set this public runtime config in `env.js`:

```js
window.__ALWENDA_ENV__ = {
  SUPABASE_URL: "https://syfahecoodziijlsasum.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "...",
  ELEVENLABS_TTS_FUNCTION_SLUG: "clever-acti..."
};
```

Do not add ElevenLabs secrets to `env.js`.

## Required Supabase Secrets

Set these on the Supabase Edge Function environment:

```bash
supabase secrets set ELEVENLABS_API_KEY=...
supabase secrets set ELEVENLABS_VOICE_ID=...
```

The function also uses Supabase-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY` to verify the authenticated user session.

## Local Function Testing

Run Supabase locally, then serve the function:

```bash
supabase start
supabase functions serve elevenlabs-tts --env-file ./supabase/.env.local
```

Example authenticated request:

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/elevenlabs-tts" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Labas, kuo galiu padėti?"}' \
  --output speech.mp3
```

## Deployment

Deploy the named function:

```bash
supabase functions deploy elevenlabs-tts
```

If a generated slug is currently live, keep `ELEVENLABS_TTS_FUNCTION_SLUG` pointed at that slug until the function is redeployed under `elevenlabs-tts`.

## Manual End-to-End Test

1. Sign in to Alwenda.
2. Open Translation.
3. Translate English text into Lithuanian.
4. Click the translated-result Speak button.
5. Confirm the button shows a loading/playing state.
6. Confirm audio plays.
7. Click Speak again while playing and confirm playback stops.
8. Sign out and confirm Speak reports that sign-in is required.
9. Test a translated result over 1,000 characters and confirm the button is disabled.

## Security Notes

- Never commit `ELEVENLABS_API_KEY` or `ELEVENLABS_VOICE_ID`.
- Never add `VITE_ELEVENLABS_*` variables.
- Browser code only receives the public function slug and Supabase publishable key.
- The Edge Function requires a valid Supabase user session.
- The Edge Function logs only operational status, not translated text, API keys, or upstream response bodies.
