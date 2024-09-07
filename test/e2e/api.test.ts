import axios from 'axios';
import sharp from 'sharp';
import redis from '../../src/helpers/redis';
import { KEY_PREFIX } from '../../src/addressResolvers/cache';

const HOST = `http://localhost:${process.env.PORT || 3003}`;
const TEST_AVATAR_ID = '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046';
const TEST_RESIZE_SIZE = 32;

async function purge(): Promise<void> {
  if (!redis) return;

  const keys = await redis.keys(`${KEY_PREFIX}:*`);
  const transaction = redis.multi();

  keys.map((key: string) => transaction.del(key));
  transaction.exec();
}

describe('E2E api', () => {
  describe('GET type/TYPE/ID', () => {
    it('returns a 400 status on invalid type', async () => {
      const makeInvalidRequest = async () => await axios.get(`${HOST}/invalid/0x123`);

      expect(makeInvalidRequest()).rejects.toThrowError(/status code 400/);
    });

    it('returns a 400 status on invalid resolver', async () => {
      const makeInvalidRequest = async () =>
        await axios.get(`${HOST}/avatar/0x123=?resolver=invalid`);

      expect(makeInvalidRequest()).rejects.toThrowError(/status code 400/);
    });

    it('returns an image of custom size and expected format', async () => {
      const response = await axios.get(`${HOST}/avatar/${TEST_AVATAR_ID}?s=${TEST_RESIZE_SIZE}`, {
        responseType: 'arraybuffer'
      });
      const metadata = await sharp(response.data).metadata();

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
      expect(response.data.length).toBeGreaterThan(0);
      expect(metadata.width).toBe(TEST_RESIZE_SIZE);
      expect(metadata.height).toBe(TEST_RESIZE_SIZE);
      expect(metadata.format).toBe('webp');
    });

    it.todo('returns a 500 status on invalid query');

    describe('when the image is not cached', () => {
      it.todo('returns the image');
      it.todo('caches the base image');
      it.todo('caches the resized image');
    });

    describe('when the base image is cached, but not the requested size', () => {
      it.todo('resize the image from the cached base image');
      it.todo('caches the resized image');
    });

    describe('when the resized image is cached', () => {
      it.todo('returns the cached resize image');
    });

    it.todo('clears the cache');
  });

  describe('POST /', () => {
    afterEach(async () => {
      await purge();
    });

    describe('when passing invalid method', () => {
      it.todo('returns an error');
    });

    describe('when method is missing', () => {
      it.todo('returns an error');
    });

    describe('on lookup_addresses', () => {
      function fetchLookupAddresses(params: any) {
        return axios({
          url: HOST,
          method: 'POST',
          responseType: 'json',
          data: { method: 'lookup_addresses', params }
        });
      }

      describe('when not passing an array as params', () => {
        const tests = [
          ['a string', 'a simple string'],
          ['an object', { a: 'b' }],
          ['a number', 123],
          ['null', null],
          ['undefined', undefined],
          ['a boolean', true]
        ];
        // @ts-ignore
        it.each(tests)('returns an error when passing %s', async (title: string, params: any) => {
          expect(fetchLookupAddresses(params)).rejects.toThrowError(/status code 400/);
        });
      });

      describe('when passing EVM addresses', () => {
        it('returns only addresses with associated domains', async () => {
          const response = await fetchLookupAddresses([
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc',
            '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1'
          ]);

          expect(response.status).toBe(200);
          expect(response.data.result).toEqual({
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC': 'sdntestens.eth',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc': 'sdntestens.eth'
          });
        });
      });

      describe('when passing non-EVM addresses', () => {
        it('returns only addresses with associated domains', async () => {
          const response = await fetchLookupAddresses([
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d',
            '0x040f81578c2ab498c1252fdebdf1ed5dc083906dc7b9e3552c362db1c7c23a02'
          ]);

          expect(response.status).toBe(200);
          expect(response.data.result).toEqual({
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D': 'Checkpoint',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d': 'Checkpoint'
          });
        });
      });

      describe('when passing a mix of EVM and non-EVM addresses', () => {
        it('returns only addresses with associated domains', async () => {
          const response = await fetchLookupAddresses([
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d',
            '0x040f81578c2ab498c1252fdebdf1ed5dc083906dc7b9e3552c362db1c7c23a02',
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc'
          ]);

          expect(response.status).toBe(200);
          expect(response.data.result).toEqual({
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D': 'Checkpoint',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d': 'Checkpoint',
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC': 'sdntestens.eth',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc': 'sdntestens.eth'
          });
        });
      });
    });
  });
});
