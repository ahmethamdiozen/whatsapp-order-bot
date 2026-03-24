jest.mock('../../src/lib/redis', () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

import { redis } from '../../src/lib/redis';
import { setSession, getSession, clearSession, OrderSession } from '../../src/lib/session';

const mockSet = redis.set as jest.Mock;
const mockGet = redis.get as jest.Mock;
const mockDel = redis.del as jest.Mock;

const PHONE = '+905001234567';

const mockSession: OrderSession = {
  locationId: 1,
  items: [{ name: 'Burger', quantity: 2, price: 9.99, menuItemId: 1 }],
  total: 19.98,
  status: 'browsing_menu',
};

describe('Session Service', () => {
  describe('setSession', () => {
    it('stores serialized session with 1-hour TTL', async () => {
      mockSet.mockResolvedValue('OK');
      await setSession(PHONE, mockSession);
      expect(mockSet).toHaveBeenCalledWith(
        `session:${PHONE}`,
        JSON.stringify(mockSession),
        'EX',
        3600,
      );
    });
  });

  describe('getSession', () => {
    it('returns parsed session when key exists', async () => {
      mockGet.mockResolvedValue(JSON.stringify(mockSession));
      const result = await getSession(PHONE);
      expect(result).toEqual(mockSession);
    });

    it('returns null when key does not exist', async () => {
      mockGet.mockResolvedValue(null);
      const result = await getSession(PHONE);
      expect(result).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('deletes the session key', async () => {
      mockDel.mockResolvedValue(1);
      await clearSession(PHONE);
      expect(mockDel).toHaveBeenCalledWith(`session:${PHONE}`);
    });
  });
});
