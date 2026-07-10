import { getAccessToken, getCachedUser } from '../components/Auth';

/** Temporary shape-compatible facade while Firebase call sites are removed. */
export const auth = {
  get currentUser() {
    const user = getCachedUser();
    return user ? { ...user, getIdToken: getAccessToken } : null;
  },
};
