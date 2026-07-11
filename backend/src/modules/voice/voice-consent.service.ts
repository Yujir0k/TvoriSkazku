import { CONSENT_TEXT, CONSENT_VERSION } from './voice-consent.schema.js';

export function getConsentInfo() {
  return {
    version: CONSENT_VERSION,
    text: CONSENT_TEXT.trim(),
  };
}
