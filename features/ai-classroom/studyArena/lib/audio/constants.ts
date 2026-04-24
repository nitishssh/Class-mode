/**
 * Audio Provider Constants
 *
 * Registry of all TTS and ASR providers with their metadata.
 * Separated from tts-providers.ts and asr-providers.ts to avoid importing
 * Node.js libraries (like sharp, buffer) in client components.
 *
 * This file is client-safe and can be imported in both client and server components.
 *
 * To add a new provider:
 * 1. Add the provider ID to TTSProviderId or ASRProviderId in types.ts
 * 2. Add provider configuration to TTS_PROVIDERS or ASR_PROVIDERS below
 * 3. Implement provider logic in tts-providers.ts or asr-providers.ts
 * 4. Add i18n translations in lib/i18n.ts
 *
 * Provider configuration should include:
 * - id: Unique identifier matching the type definition
 * - name: Display name for the provider
 * - requiresApiKey: Whether the provider needs an API key
 * - defaultBaseUrl: Default API endpoint (optional)
 * - icon: Path to provider icon (optional)
 * - voices: Array of available voices (TTS only)
 * - supportedFormats: Audio formats supported by the provider
 * - speedRange: Min/max/default speed settings (TTS only)
 * - supportedLanguages: Languages supported by the provider (ASR only)
 */

import type {
  TTSProviderId,
  TTSProviderConfig,
  TTSVoiceInfo,
  ASRProviderId,
  ASRProviderConfig,
} from './types';

/**
 * TTS Provider Registry
 *
 * Central registry for all TTS providers.
 * Keep in sync with TTSProviderId type definition.
 */
export const TTS_PROVIDERS: Record<TTSProviderId, TTSProviderConfig> = {
  'openai-tts': {
    id: 'openai-tts',
    name: 'OpenAI TTS',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    icon: '/logos/openai.svg',
    voices: [
      // Recommended voices (best quality)
      {
        id: 'marin',
        name: 'Marin',
        language: 'en',
        gender: 'neutral',
        description: 'voiceMarin',
      },
      {
        id: 'cedar',
        name: 'Cedar',
        language: 'en',
        gender: 'neutral',
        description: 'voiceCedar',
      },
      // Standard voices (alphabetical)
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'en',
        gender: 'neutral',
        description: 'voiceAlloy',
      },
      {
        id: 'ash',
        name: 'Ash',
        language: 'en',
        gender: 'neutral',
        description: 'voiceAsh',
      },
      {
        id: 'ballad',
        name: 'Ballad',
        language: 'en',
        gender: 'neutral',
        description: 'voiceBallad',
      },
      {
        id: 'coral',
        name: 'Coral',
        language: 'en',
        gender: 'neutral',
        description: 'voiceCoral',
      },
      {
        id: 'echo',
        name: 'Echo',
        language: 'en',
        gender: 'male',
        description: 'voiceEcho',
      },
      {
        id: 'fable',
        name: 'Fable',
        language: 'en',
        gender: 'neutral',
        description: 'voiceFable',
      },
      {
        id: 'nova',
        name: 'Nova',
        language: 'en',
        gender: 'female',
        description: 'voiceNova',
      },
      {
        id: 'onyx',
        name: 'Onyx',
        language: 'en',
        gender: 'male',
        description: 'voiceOnyx',
      },
      {
        id: 'sage',
        name: 'Sage',
        language: 'en',
        gender: 'neutral',
        description: 'voiceSage',
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        language: 'en',
        gender: 'female',
        description: 'voiceShimmer',
      },
      {
        id: 'verse',
        name: 'Verse',
        language: 'en',
        gender: 'neutral',
        description: 'voiceVerse',
      },
    ],
    supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
    speedRange: { min: 0.25, max: 4.0, default: 1.0 },
  },

  'azure-tts': {
    id: 'azure-tts',
    name: 'Azure TTS',
    requiresApiKey: true,
    defaultBaseUrl: 'https://{region}.tts.speech.microsoft.com',
    icon: '/logos/azure.svg',
    voices: [
      {
        id: 'zh-CN-XiaoxiaoNeural',
        name: 'Xiaoxiao (Female)',
        language: 'en-US',
        gender: 'female',
      },
      {
        id: 'zh-CN-YunxiNeural',
        name: 'Yunxi (Male)',
        language: 'en-US',
        gender: 'male',
      },
      {
        id: 'zh-CN-XiaoyiNeural',
        name: 'Xiaoyi (Female)',
        language: 'en-US',
        gender: 'female',
      },
      {
        id: 'zh-CN-YunjianNeural',
        name: 'Yunjian (Male)',
        language: 'en-US',
        gender: 'male',
      },
      {
        id: 'en-US-JennyNeural',
        name: 'Jenny',
        language: 'en-US',
        gender: 'female',
      },
      { id: 'en-US-GuyNeural', name: 'Guy', language: 'en-US', gender: 'male' },
    ],
    supportedFormats: ['mp3', 'wav', 'ogg'],
    speedRange: { min: 0.5, max: 2.0, default: 1.0 },
  },

  'glm-tts': {
    id: 'glm-tts',
    name: 'GLM TTS',
    requiresApiKey: true,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    icon: '/logos/glm.svg',
    voices: [
      {
        id: 'tongtong',
        name: 'Tongtong',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceTongtong',
      },
      {
        id: 'chuichui',
        name: 'Chuichui',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceChuichui',
      },
      {
        id: 'xiaochen',
        name: 'Xiaochen',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceXiaochen',
      },
      {
        id: 'jam',
        name: 'Jam',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceJam',
      },
      {
        id: 'kazi',
        name: 'Kazi',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceKazi',
      },
      {
        id: 'douji',
        name: 'Douji',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceDouji',
      },
      {
        id: 'luodo',
        name: 'Luoduo',
        language: 'zh',
        gender: 'neutral',
        description: 'glmVoiceLuodo',
      },
    ],
    supportedFormats: ['wav'],
    speedRange: { min: 0.5, max: 2.0, default: 1.0 },
  },

  'qwen-tts': {
    id: 'qwen-tts',
    name: 'Qwen TTS (Alibaba Cloud)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    icon: '/logos/bailian.svg',
    voices: [
      // Standard Mandarin voices
      {
        id: 'Cherry',
        name: 'Qianyue (Cherry)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceCherry',
      },
      {
        id: 'Serena',
        name: 'Suyao (Serena)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceSerena',
      },
      {
        id: 'Ethan',
        name: 'Chenxu (Ethan)',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceEthan',
      },
      {
        id: 'Chelsie',
        name: 'Qianxue (Chelsie)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceChelsie',
      },
      {
        id: 'Momo',
        name: 'Motu (Momo)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceMomo',
      },
      {
        id: 'Vivian',
        name: 'Shisan (Vivian)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceVivian',
      },
      {
        id: 'Moon',
        name: 'Yuebai (Moon)',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceMoon',
      },
      {
        id: 'Maia',
        name: 'Siyue (Maia)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceMaia',
      },
      {
        id: 'Kai',
        name: 'Kai',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceKai',
      },
      {
        id: 'Nofish',
        name: 'Nofish',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceNofish',
      },
      {
        id: 'Bella',
        name: 'Mengbao (Bella)',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceBella',
      },
      {
        id: 'Jennifer',
        name: 'Jennifer',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceJennifer',
      },
      {
        id: 'Ryan',
        name: 'Tiancha (Ryan)',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceRyan',
      },
      {
        id: 'Katerina',
        name: 'Katerina',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceKaterina',
      },
      {
        id: 'Aiden',
        name: 'Aiden',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceAiden',
      },
      {
        id: 'Eldric Sage',
        name: 'Eldric Sage',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceEldricSage',
      },
      {
        id: 'Mia',
        name: 'Mia',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceMia',
      },
      {
        id: 'Mochi',
        name: 'Mochi',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceMochi',
      },
      {
        id: 'Bellona',
        name: 'Bellona',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceBellona',
      },
      {
        id: 'Vincent',
        name: 'Vincent',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceVincent',
      },
      {
        id: 'Bunny',
        name: 'Bunny',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceBunny',
      },
      {
        id: 'Neil',
        name: 'Neil',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceNeil',
      },
      {
        id: 'Elias',
        name: 'Elias',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceElias',
      },
      {
        id: 'Arthur',
        name: 'Arthur',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceArthur',
      },
      {
        id: 'Nini',
        name: 'Nini',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceNini',
      },
      {
        id: 'Ebona',
        name: 'Ebona',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceEbona',
      },
      {
        id: 'Seren',
        name: 'Seren',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceSeren',
      },
      {
        id: 'Pip',
        name: 'Pip',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoicePip',
      },
      {
        id: 'Stella',
        name: 'Stella',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceStella',
      },
      // International voices
      {
        id: 'Bodega',
        name: 'Bodega',
        language: 'es',
        gender: 'male',
        description: 'qwenVoiceBodega',
      },
      {
        id: 'Sonrisa',
        name: 'Sonrisa',
        language: 'es',
        gender: 'female',
        description: 'qwenVoiceSonrisa',
      },
      {
        id: 'Alek',
        name: 'Alek',
        language: 'ru',
        gender: 'male',
        description: 'qwenVoiceAlek',
      },
      {
        id: 'Dolce',
        name: 'Dolce',
        language: 'it',
        gender: 'male',
        description: 'qwenVoiceDolce',
      },
      {
        id: 'Sohee',
        name: 'Sohee',
        language: 'ko',
        gender: 'female',
        description: 'qwenVoiceSohee',
      },
      {
        id: 'Ono Anna',
        name: 'Ono Anna',
        language: 'ja',
        gender: 'female',
        description: 'qwenVoiceOnoAnna',
      },
      {
        id: 'Lenn',
        name: 'Lenn',
        language: 'de',
        gender: 'male',
        description: 'qwenVoiceLenn',
      },
      {
        id: 'Emilien',
        name: 'Emilien',
        language: 'fr',
        gender: 'male',
        description: 'qwenVoiceEmilien',
      },
      {
        id: 'Andre',
        name: 'Andre',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceAndre',
      },
      {
        id: 'Radio Gol',
        name: 'Radio Gol',
        language: 'pt',
        gender: 'male',
        description: 'qwenVoiceRadioGol',
      },
      // Dialect voices
      {
        id: 'Jada',
        name: 'Shanghai-Jada',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceJada',
      },
      {
        id: 'Dylan',
        name: 'Beijing-Dylan',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceDylan',
      },
      {
        id: 'Li',
        name: 'Nanjing-Li',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceLi',
      },
      {
        id: 'Marcus',
        name: 'Shaanxi-Marcus',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceMarcus',
      },
      {
        id: 'Roy',
        name: 'Minnan-Roy',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceRoy',
      },
      {
        id: 'Peter',
        name: 'Tianjin-Peter',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoicePeter',
      },
      {
        id: 'Sunny',
        name: 'Sichuan-Sunny',
        language: 'en-US',
        gender: 'female',
        description: 'qwenVoiceSunny',
      },
      {
        id: 'Eric',
        name: 'Sichuan-Eric',
        language: 'en-US',
        gender: 'male',
        description: 'qwenVoiceEric',
      },
      {
        id: 'Rocky',
        name: 'Cantonese-Rocky',
        language: 'zh-HK',
        gender: 'male',
        description: 'qwenVoiceRocky',
      },
      {
        id: 'Kiki',
        name: 'Cantonese-Kiki',
        language: 'zh-HK',
        gender: 'female',
        description: 'qwenVoiceKiki',
      },
    ],
    supportedFormats: ['mp3', 'wav', 'pcm'],
  },

  'browser-native-tts': {
    id: 'browser-native-tts',
    name: 'Browser Native (Web Speech API)',
    requiresApiKey: false,
    icon: '/logos/browser.svg',
    voices: [
      // Note: Actual voices are determined by the browser and OS
      // These are placeholder - real voices are fetched dynamically via speechSynthesis.getVoices()
      { id: 'default', name: 'Default', language: 'en-US', gender: 'neutral' },
    ],
    supportedFormats: ['browser'], // Browser native audio
    speedRange: { min: 0.1, max: 10.0, default: 1.0 },
  },
};

/**
 * ASR Provider Registry
 *
 * Central registry for all ASR providers.
 * Keep in sync with ASRProviderId type definition.
 */
export const ASR_PROVIDERS: Record<ASRProviderId, ASRProviderConfig> = {
  'openai-whisper': {
    id: 'openai-whisper',
    name: 'OpenAI Whisper',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    icon: '/logos/openai.svg',
    supportedLanguages: [
      // OpenAI Whisper supports 58 languages (as of official docs)
      // Source: https://platform.openai.com/docs/guides/speech-to-text
      'auto', // Auto-detect
      // Hot languages (commonly used)
      'zh', // Chinese
      'en', // English
      'ja', // Japanese
      'ko', // Korean
      'es', // Spanish
      'fr', // French
      'de', // German
      'ru', // Russian
      'ar', // Arabic
      'pt', // Portuguese
      'it', // Italian
      'hi', // Hindi
      // Other languages (alphabetical)
      'af', // Afrikaans
      'hy', // Armenian
      'az', // Azerbaijani
      'be', // Belarusian
      'bs', // Bosnian
      'bg', // Bulgarian
      'ca', // Catalan
      'hr', // Croatian
      'cs', // Czech
      'da', // Danish
      'nl', // Dutch
      'et', // Estonian
      'fi', // Finnish
      'gl', // Galician
      'el', // Greek
      'he', // Hebrew
      'hu', // Hungarian
      'is', // Icelandic
      'id', // Indonesian
      'kn', // Kannada
      'kk', // Kazakh
      'lv', // Latvian
      'lt', // Lithuanian
      'mk', // Macedonian
      'ms', // Malay
      'mr', // Marathi
      'mi', // Maori
      'ne', // Nepali
      'no', // Norwegian
      'fa', // Persian
      'pl', // Polish
      'ro', // Romanian
      'sr', // Serbian
      'sk', // Slovak
      'sl', // Slovenian
      'sw', // Swahili
      'sv', // Swedish
      'tl', // Tagalog
      'ta', // Tamil
      'th', // Thai
      'tr', // Turkish
      'uk', // Ukrainian
      'ur', // Urdu
      'vi', // Vietnamese
      'cy', // Welsh
    ],
    supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
  },

  'qwen-asr': {
    id: 'qwen-asr',
    name: 'Qwen ASR (Alibaba Cloud)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    icon: '/logos/bailian.svg',
    supportedLanguages: [
      // Qwen ASR supports 27 languages + auto-detect
      // If language is uncertain or mixed (e.g. Chinese-English-Japanese-Korean), use "auto" (do not specify language parameter)
      'auto', // Auto-detect (do not specify language parameter)
      // Hot languages (commonly used)
      'zh', // Chinese (Mandarin, Sichuanese, Minnan, Wu dialects)
      'yue', // Cantonese
      'en', // English
      'ja', // Japanese
      'ko', // Korean
      'de', // German
      'fr', // French
      'ru', // Russian
      'es', // Spanish
      'pt', // Portuguese
      'ar', // Arabic
      'it', // Italian
      'hi', // Hindi
      // Other languages (alphabetical)
      'cs', // Czech
      'da', // Danish
      'fi', // Finnish
      'fil', // Filipino
      'id', // Indonesian
      'is', // Icelandic
      'ms', // Malay
      'no', // Norwegian
      'pl', // Polish
      'sv', // Swedish
      'th', // Thai
      'tr', // Turkish
      'uk', // Ukrainian
      'vi', // Vietnamese
    ],
    supportedFormats: ['mp3', 'wav', 'webm', 'm4a', 'flac'],
  },

  'browser-native': {
    id: 'browser-native',
    name: 'Browser Native ASR (Web Speech API)',
    requiresApiKey: false,
    icon: '/logos/browser.svg',
    supportedLanguages: [
      // Chinese variants
      'en-US', // Mandarin (Simplified, China)
      'zh-TW', // Mandarin (Traditional, Taiwan)
      'zh-HK', // Cantonese (Hong Kong)
      'yue-Hant-HK', // Cantonese (Traditional)
      // English variants
      'en-US', // English (United States)
      'en-GB', // English (United Kingdom)
      'en-AU', // English (Australia)
      'en-CA', // English (Canada)
      'en-IN', // English (India)
      'en-NZ', // English (New Zealand)
      'en-ZA', // English (South Africa)
      // Japanese & Korean
      'ja-JP', // Japanese (Japan)
      'ko-KR', // Korean (South Korea)
      // European languages
      'de-DE', // German (Germany)
      'fr-FR', // French (France)
      'es-ES', // Spanish (Spain)
      'es-MX', // Spanish (Mexico)
      'es-AR', // Spanish (Argentina)
      'es-CO', // Spanish (Colombia)
      'it-IT', // Italian (Italy)
      'pt-BR', // Portuguese (Brazil)
      'pt-PT', // Portuguese (Portugal)
      'ru-RU', // Russian (Russia)
      'nl-NL', // Dutch (Netherlands)
      'pl-PL', // Polish (Poland)
      'cs-CZ', // Czech (Czech Republic)
      'da-DK', // Danish (Denmark)
      'fi-FI', // Finnish (Finland)
      'sv-SE', // Swedish (Sweden)
      'no-NO', // Norwegian (Norway)
      'tr-TR', // Turkish (Turkey)
      'el-GR', // Greek (Greece)
      'hu-HU', // Hungarian (Hungary)
      'ro-RO', // Romanian (Romania)
      'sk-SK', // Slovak (Slovakia)
      'bg-BG', // Bulgarian (Bulgaria)
      'hr-HR', // Croatian (Croatia)
      'ca-ES', // Catalan (Spain)
      // Middle East & Asia
      'ar-SA', // Arabic (Saudi Arabia)
      'ar-EG', // Arabic (Egypt)
      'he-IL', // Hebrew (Israel)
      'hi-IN', // Hindi (India)
      'th-TH', // Thai (Thailand)
      'vi-VN', // Vietnamese (Vietnam)
      'id-ID', // Indonesian (Indonesia)
      'ms-MY', // Malay (Malaysia)
      'fil-PH', // Filipino (Philippines)
      // Other
      'af-ZA', // Afrikaans (South Africa)
      'uk-UA', // Ukrainian (Ukraine)
    ],
    supportedFormats: ['webm'], // MediaRecorder format
  },
};

/**
 * Get all available TTS providers
 */
export function getAllTTSProviders(): TTSProviderConfig[] {
  return Object.values(TTS_PROVIDERS);
}

/**
 * Get TTS provider by ID
 */
export function getTTSProvider(providerId: TTSProviderId): TTSProviderConfig | undefined {
  return TTS_PROVIDERS[providerId];
}

/**
 * Default voice for each TTS provider.
 * Used when switching providers or testing a non-active provider.
 */
export const DEFAULT_TTS_VOICES: Record<TTSProviderId, string> = {
  'openai-tts': 'alloy',
  'azure-tts': 'zh-CN-XiaoxiaoNeural',
  'glm-tts': 'tongtong',
  'qwen-tts': 'Cherry',
  'browser-native-tts': 'default',
};

/**
 * Get voices for a specific TTS provider
 */
export function getTTSVoices(providerId: TTSProviderId): TTSVoiceInfo[] {
  return TTS_PROVIDERS[providerId]?.voices || [];
}

/**
 * Get all available ASR providers
 */
export function getAllASRProviders(): ASRProviderConfig[] {
  return Object.values(ASR_PROVIDERS);
}

/**
 * Get ASR provider by ID
 */
export function getASRProvider(providerId: ASRProviderId): ASRProviderConfig | undefined {
  return ASR_PROVIDERS[providerId];
}

/**
 * Get supported languages for a specific ASR provider
 */
export function getASRSupportedLanguages(providerId: ASRProviderId): string[] {
  return ASR_PROVIDERS[providerId]?.supportedLanguages || [];
}
