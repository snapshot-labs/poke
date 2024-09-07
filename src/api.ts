import express from 'express';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { parseQuery, resize, setHeader, getCacheKey, ResolverType } from './utils';
import { set, get, streamToBuffer, clear } from './aws';
import { resolve, resolverExists } from './resolvers';
import constants from './constants.json';
import { rpcError, rpcSuccess } from './helpers/utils';
import { lookupAddresses, resolveNames, clearCache } from './addressResolvers';
import lookupDomains from './lookupDomains';

const router = express.Router();
const TYPE_CONSTRAINTS = [...Object.keys(constants.resolvers), 'address', 'name'].join('|');

router.post('/', async (req, res) => {
  const { id = null, method, params } = req.body;
  if (!method) return rpcError(res, 400, 'missing method', id);
  try {
    let result: any = {};

    if (method === 'lookup_domains') {
      result = await lookupDomains(params, req.body.network);
    } else if (['lookup_addresses', 'resolve_names'].includes(method)) {
      if (!Array.isArray(params))
        return rpcError(res, 400, 'params must be an array of string', id);

      if (method === 'lookup_addresses') result = await lookupAddresses(params);
      else result = await resolveNames(params);
    } else return rpcError(res, 400, 'invalid method', id);

    if (result?.error) return rpcError(res, result.code || 500, result.error, id);
    return rpcSuccess(res, result, id);
  } catch (e) {
    const err = e as any;
    capture(err.error ? new Error(err.error) : err);
    return rpcError(res, 500, e, id);
  }
});

router.get(`/clear/:type(${TYPE_CONSTRAINTS})/:id`, async (req, res) => {
  const { type, id } = req.params as { type: ResolverType; id: string };

  try {
    let result = false;

    if (type === 'address' || type === 'name') {
      result = await clearCache(id);
    } else {
      const { address, network, w, h, fallback, cb } = await parseQuery(id, type, {
        s: constants.max,
        fb: req.query.fb,
        cb: req.query.cb
      });
      const key = getCacheKey({ type, network, address, w, h, fallback, cb });
      result = await clear(key);
    }
    res.status(result ? 200 : 404).json({ status: result ? 'ok' : 'not found' });
  } catch (e) {
    capture(e);
    res.status(500).json({ status: 'error', error: 'failed to clear cache' });
  }
});

router.get(`/:type(${TYPE_CONSTRAINTS})/:id`, async (req, res) => {
  const { type, id } = req.params as { type: ResolverType; id: string };
  let address, network, w, h, fallback, cb, resolver;

  try {
    ({ address, network, w, h, fallback, cb, resolver } = await parseQuery(id, type, req.query));
  } catch (e) {
    return res.status(500).json({ status: 'error', error: 'failed to load content' });
  }

  if (resolver && !resolverExists(type, resolver)) {
    return res.status(400).json({ status: 'error', error: 'invalid resolvers' });
  }

  const disableCache = !!resolver;

  const key1 = getCacheKey({
    type,
    network,
    address,
    w: constants.max,
    h: constants.max,
    fallback,
    cb
  });
  const key2 = getCacheKey({ type, network, address, w, h, fallback, cb });

  // Check resized cache
  const cache = await get(`${key1}/${key2}`);
  if (cache && !disableCache) {
    // console.log('Got cache', address);
    setHeader(res);
    return cache.pipe(res);
  }

  // Check base cache
  const base = await get(`${key1}/${key1}`);
  let baseImage;
  if (base) {
    baseImage = await streamToBuffer(base);
  } else {
    const images = await resolve(type, address, network, resolver ? [resolver] : undefined);
    baseImage = [...images].reverse().find(file => !!file);

    if (!baseImage) {
      const fallbackImage = (await resolve(type, address, network, [fallback]))[0];
      const resizedImage = await resize(fallbackImage, w, h);

      setHeader(res, 'SHORT_CACHE');
      return res.send(resizedImage);
    }
  }

  // Resize and return image
  const resizedImage = await resize(baseImage, w, h);
  setHeader(res);
  res.send(resizedImage);

  if (disableCache) return;

  // Store cache
  try {
    if (!base) {
      await set(`${key1}/${key1}`, baseImage);
      console.log('Stored base cache', key1);
    }
    await set(`${key1}/${key2}`, resizedImage);
    console.log('Stored cache', address);
  } catch (e) {
    capture(e);
    console.log('Store cache failed', address, e);
  }
});

export default router;
