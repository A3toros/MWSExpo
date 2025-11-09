import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Current ToS version - increment when ToS content changes
 * Format: MAJOR.MINOR.PATCH
 * - Increment MAJOR for significant changes (e.g., new data collection)
 * - Increment MINOR for moderate changes (e.g., updated policies)
 * - Increment PATCH for minor changes (e.g., wording updates)
 * 
 * When version changes, users will be prompted to accept again on next login.
 */
const CURRENT_TOS_VERSION = '1.0.0';

const STORAGE_KEYS = {
  TOS_ACCEPTED: 'tos_accepted',
  TOS_VERSION: 'tos_version',
};

export interface TermsOfServiceData {
  version: string;
  acceptedAt: string;
}

class TermsOfServiceService {
  /**
   * Get current ToS version
   */
  getCurrentVersion(): string {
    return CURRENT_TOS_VERSION;
  }

  /**
   * Check if user has accepted the current ToS version
   */
  async isAccepted(): Promise<boolean> {
    try {
      const acceptedVersion = await AsyncStorage.getItem(STORAGE_KEYS.TOS_VERSION);
      return acceptedVersion === CURRENT_TOS_VERSION;
    } catch (error) {
      console.error('[ToSService] Error checking ToS acceptance:', error);
      return false;
    }
  }

  /**
   * Get accepted ToS data
   */
  async getAcceptedData(): Promise<TermsOfServiceData | null> {
    try {
      const version = await AsyncStorage.getItem(STORAGE_KEYS.TOS_VERSION);
      const acceptedAt = await AsyncStorage.getItem(STORAGE_KEYS.TOS_ACCEPTED);

      if (version && acceptedAt) {
        return {
          version,
          acceptedAt,
        };
      }

      return null;
    } catch (error) {
      console.error('[ToSService] Error getting ToS data:', error);
      return null;
    }
  }

  /**
   * Accept Terms of Service
   */
  async accept(): Promise<void> {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.TOS_ACCEPTED, now);
      await AsyncStorage.setItem(STORAGE_KEYS.TOS_VERSION, CURRENT_TOS_VERSION);
      console.log('[ToSService] Terms of Service accepted', { version: CURRENT_TOS_VERSION, acceptedAt: now });
    } catch (error) {
      console.error('[ToSService] Error accepting ToS:', error);
      throw error;
    }
  }

  /**
   * Check if ToS needs to be re-accepted (version changed)
   */
  async needsReacceptance(): Promise<boolean> {
    try {
      const acceptedVersion = await AsyncStorage.getItem(STORAGE_KEYS.TOS_VERSION);
      return acceptedVersion !== CURRENT_TOS_VERSION;
    } catch (error) {
      console.error('[ToSService] Error checking ToS reacceptance:', error);
      return true; // If error, assume needs acceptance
    }
  }
}

export const termsOfServiceService = new TermsOfServiceService();

