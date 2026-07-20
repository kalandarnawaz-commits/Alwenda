import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

async function readSourceTree(dir) {
  const entries = await readdir(`${rootDir}${dir}`, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return readSourceTree(path);
      if (!entry.isFile()) return [];
      return [{ path, text: await readRepoFile(path) }];
    })
  );
  return files.flat();
}

test("ElevenLabs Edge Function handles auth, validation, safe errors, and audio response", async () => {
  const source = await readRepoFile("supabase/functions/elevenlabs-tts/index.ts");

  assert.match(source, /Deno\.env\.get\("ELEVENLABS_API_KEY"\)/);
  assert.match(source, /Deno\.env\.get\("ELEVENLABS_VOICE_ID"\)/);
  assert.match(source, /req\.method === "OPTIONS"/);
  assert.match(source, /req\.method !== "POST"/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /Authentication required\.", 401/);
  assert.match(source, /Text is required\.", 400/);
  assert.match(source, /MAX_TEXT_LENGTH = 1000/);
  assert.match(source, /Speech playback is not configured yet\.", 503/);
  assert.match(source, /https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech/);
  assert.match(source, /model_id: "eleven_multilingual_v2"/);
  assert.doesNotMatch(source, /language_code/);
  assert.match(source, /Content-Type": "audio\/mpeg"/);
  assert.match(source, /speechProviderError\(status: number\)/);
  assert.match(source, /Speech provider credentials need attention\./);
  assert.match(source, /Speech voice is not available\. Check the configured voice\./);
  assert.match(source, /Speech provider could not use this text or voice\./);
  assert.match(source, /status === 429/);
  assert.doesNotMatch(source, /console\.log\(ELEVENLABS_API_KEY/);
  assert.doesNotMatch(source, /errorBody/);
});

test("frontend voice service calls the configured Supabase function with translated text only", async () => {
  const source = await readRepoFile("src/services/voiceService.js");

  assert.match(source, /ELEVENLABS_TTS_FUNCTION_SLUG/);
  assert.match(source, /MAX_TRANSLATION_SPEECH_CHARACTERS = 1000/);
  assert.match(source, /getSupabaseAccessToken\(\)/);
  assert.match(source, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(source, /apikey: SUPABASE_ANON_KEY/);
  assert.match(source, /JSON\.stringify\(\{ text: trimmed \}\)/);
  assert.match(source, /contentType\.toLowerCase\(\)\.startsWith\("audio\/"\)/);
  assert.match(source, /URL\.createObjectURL\(blob\)/);
  assert.match(source, /URL\.revokeObjectURL\(activeObjectUrl\)/);
  assert.match(source, /activeRequest/);
  assert.match(source, /stopTranslationSpeech/);
});

test("translation UI sends the successful translated result to cloud speech", async () => {
  const source = await readRepoFile("src/main.js");

  assert.match(source, /speakTranslatedText\(/);
  assert.match(source, /const text = isSource \? state\.translateInputText\.trim\(\) : state\.translateOutputText\.trim\(\)/);
  assert.match(source, /panel === "to"/);
  assert.match(source, /translationSpeechTooLong/);
  assert.match(source, /translate\.generatingSpeech/);
  assert.match(source, /stopTranslationSpeech\(\)/);
});

test("translation voice input follows the selected source language in every translator surface", async () => {
  const source = await readRepoFile("src/main.js");

  assert.match(source, /"translate\.language\.langLithuanian": \["lt-LT", "lt"\]/);
  assert.match(source, /const sourceLanguage = state\.translateFromLanguage/);
  assert.match(source, /recognition\.lang = recognitionLocales\[localeIndex\]/);
  assert.match(source, /translate\.listeningInLanguage/);
  assert.doesNotMatch(source, /requestMicrophoneAccessForVoiceInput/);
  assert.match(source, /document\.querySelectorAll\("\[data-translate-from\]"\)/);
  assert.match(source, /document\.querySelectorAll\("\[data-translate-record\]"\)/);
  assert.doesNotMatch(source, /document\.querySelector\("\[data-translate-from\]"\)\?\.addEventListener/);
  assert.doesNotMatch(source, /document\.querySelector\("\[data-translate-record\]"\)\?\.addEventListener/);
});

test("translation voice input falls back to secure audio transcription when browser speech fails", async () => {
  const mainSource = await readRepoFile("src/main.js");
  const clientSource = await readRepoFile("src/services/translationTranscriptionService.js");
  const functionSource = await readRepoFile("supabase/functions/translate-transcribe/index.ts");

  assert.match(mainSource, /transcribeTranslationAudio/);
  assert.match(mainSource, /startAudioTranscriptionFallback/);
  assert.match(mainSource, /navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\)/);
  assert.match(mainSource, /new MediaRecorder/);
  assert.match(mainSource, /TRANSLATION_AUDIO_RECORDING_MS = 7000/);
  assert.match(mainSource, /"not-allowed"/);
  assert.match(mainSource, /"language-not-supported"/);
  assert.match(mainSource, /translate\.processingVoice/);

  assert.match(clientSource, /TRANSLATE_TRANSCRIBE_FUNCTION_SLUG/);
  assert.match(clientSource, /getSupabaseAccessToken\(\)/);
  assert.match(clientSource, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(clientSource, /formData\.append\("audio", audioBlob/);
  assert.match(clientSource, /MAX_TRANSLATION_AUDIO_BYTES/);
  assert.doesNotMatch(clientSource, /OPENAI_API_KEY/);

  assert.match(functionSource, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(functionSource, /supabase\.auth\.getUser\(\)/);
  assert.match(functionSource, /Authentication required\.", 401/);
  assert.match(functionSource, /MAX_AUDIO_BYTES = 8 \* 1024 \* 1024/);
  assert.match(functionSource, /await req\.formData\(\)/);
  assert.match(functionSource, /https:\/\/api\.openai\.com\/v1\/audio\/transcriptions/);
  assert.match(functionSource, /openAiBody\.append\("model", "whisper-1"\)/);
  assert.match(functionSource, /openAiBody\.append\("language", language\)/);
  assert.match(functionSource, /return jsonResponse\(\{ text \}\)/);
  assert.doesNotMatch(functionSource, /console\.log\(OPENAI_API_KEY/);
});

test("browser source never exposes ElevenLabs secrets or VITE-style speech keys", async () => {
  const sourceFiles = await readSourceTree("src");
  for (const file of sourceFiles) {
    assert.ok(!file.text.includes("ELEVENLABS_API_KEY"), `${file.path} must not expose ELEVENLABS_API_KEY`);
    assert.ok(!file.text.includes("ELEVENLABS_VOICE_ID"), `${file.path} must not expose ELEVENLABS_VOICE_ID`);
    assert.ok(!file.text.includes("OPENAI_API_KEY"), `${file.path} must not expose OPENAI_API_KEY`);
    assert.ok(!file.text.includes("VITE_ELEVENLABS"), `${file.path} must not use VITE_ELEVENLABS`);
  }

  const envExample = await readRepoFile("env.example.js");
  assert.ok(!envExample.includes("ELEVENLABS_API_KEY"));
  assert.ok(!envExample.includes("ELEVENLABS_VOICE_ID"));
  assert.ok(!envExample.includes("OPENAI_API_KEY"));
  assert.ok(!envExample.includes("VITE_ELEVENLABS"));
  assert.match(envExample, /ELEVENLABS_TTS_FUNCTION_SLUG/);
  assert.match(envExample, /TRANSLATE_TRANSCRIBE_FUNCTION_SLUG/);
});

test("Lithuanian voice input skips the unreliable on-device recognizer and goes straight to Whisper transcription", async () => {
  const mainSource = await readRepoFile("src/main.js");

  assert.match(mainSource, /const VOICE_INPUT_UNSUPPORTED_LANGUAGES = new Set\(\["translate\.language\.langLithuanian"\]\)/);
  assert.match(mainSource, /if \(!Ctor \|\| VOICE_INPUT_UNSUPPORTED_LANGUAGES\.has\(sourceLanguage\)\) \{\s*startAudioTranscriptionFallback\(sourceLanguage, sourceLanguageLabel\);/);

  // The Whisper edge function itself must actually support Lithuanian —
  // this fix is worthless if the fallback it routes to doesn't.
  const functionSource = await readRepoFile("supabase/functions/translate-transcribe/index.ts");
  assert.match(functionSource, /SUPPORTED_LANGUAGES = new Set\(\["lt", "en", "ru", "pl", "de", "fr"\]\)/);
});

test("audio transcription fallback surfaces the real failure reason instead of one generic message", async () => {
  const mainSource = await readRepoFile("src/main.js");
  const fallback = mainSource.slice(mainSource.indexOf("async function startAudioTranscriptionFallback"), mainSource.indexOf("async function startAudioTranscriptionFallback") + 3000);

  assert.match(fallback, /\} catch \(error\) \{/);
  assert.match(fallback, /state\.translateVoiceError = error\?\.message \|\| t\("translate\.voiceRecognitionError"\)/);
});
