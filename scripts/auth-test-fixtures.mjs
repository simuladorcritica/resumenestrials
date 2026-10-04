export const fakeSupabaseModule = `
const eventKey = 'rt-auth-safe-events';
const log = (type, payload = {}) => {
  const current = JSON.parse(localStorage.getItem(eventKey) || '[]');
  current.push({ type, payload });
  localStorage.setItem(eventKey, JSON.stringify(current));
};
let user = null;
const ok = (data = {}) => ({ data, error: null });
export function createClient() {
  return {
    auth: {
      async signUp(payload) { log('signup', payload); return ok({ user: { id: 'local-signup-user' } }); },
      async signInWithPassword(payload) { user = { id: 'local-login-user', email: payload.email }; log('email-login', payload); return ok({ user, session: { access_token: 'local-access' } }); },
      async setSession(payload) { user = { id: 'local-username-user' }; log('set-session', payload); return ok({ user, session: payload }); },
      async resetPasswordForEmail(email, options) { log('password-reset-request', { email, options }); return ok({}); },
      async updateUser(payload) { user = { id: 'local-password-user' }; log('password-update', payload); return ok({ user }); },
      async getUser() { return ok({ user }); },
      async getSession() { return ok({ session: user ? { user } : null }); },
      onAuthStateChange() { return ok({ subscription: { unsubscribe() {} } }); },
      async signOut() { user = null; return ok({}); },
      mfa: {
        async getAuthenticatorAssuranceLevel() { return ok({ currentLevel: 'aal1', nextLevel: 'aal1' }); },
        async listFactors() { return ok({ totp: [] }); },
      },
    },
  };
}
`;

