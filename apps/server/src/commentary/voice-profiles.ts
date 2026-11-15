type VoiceProfile = {
  id: string;
  label: string;
  language: 'hi' | 'en';
  voiceId: string;
  dialect?: 'haryanvi';
};

export function voiceProfiles(): VoiceProfile[] {
  try {
    const entries: unknown = JSON.parse(process.env.COMMENTARY_VOICE_PROFILES?.trim() || '[]');
    if (!Array.isArray(entries)) return [];
    const profiles = new Map<string, VoiceProfile>();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const {id, label, language, voiceId, dialect} = entry;
      if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id) ||
          typeof label !== 'string' || !label.trim() || label.length > 80 ||
          (language !== 'hi' && language !== 'en') ||
          typeof voiceId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(voiceId) ||
          (dialect !== undefined && (dialect !== 'haryanvi' || language !== 'hi'))) continue;
      if (!profiles.has(id)) profiles.set(id, {id, label: label.trim(), language, voiceId, dialect});
    }
    return [...profiles.values()];
  } catch {
    return [];
  }
}

export function configuredVoiceProfile(id: string, language: VoiceProfile['language']) {
  return id ? voiceProfiles().find(profile => profile.id === id && profile.language === language) : undefined;
}
