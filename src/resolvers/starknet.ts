import fetch from 'node-fetch';
import { Provider, RpcProvider } from 'starknet';
import { getUrl, resize } from '../utils';
import { max } from '../constants.json';
import { fetchHttpImage } from './utils';

const provider = new Provider(
  new RpcProvider({
    nodeUrl: process.env.INFURA_API_KEY
      ? `https://starknet-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
      : 'https://starknet-mainnet.public.blastapi.io'
  })
);

function isStarknetDomain(domain: string): boolean {
  return domain.endsWith('.stark');
}

function normalizeAddress(address: string): string {
  if (!address.match(/^(0x)?[0-9a-fA-F]{64}$/)) throw new Error('Invalid starknet address');

  return address;
}

async function getStarknetAddress(domain: string): Promise<string | null> {
  const address = await provider.getAddressFromStarkName(domain);

  return address === '0x0' ? null : address;
}

async function getImage(domainOrAddress: string): Promise<string | null> {
  const address = isStarknetDomain(domainOrAddress)
    ? await getStarknetAddress(domainOrAddress)
    : normalizeAddress(domainOrAddress);

  if (!address) return null;

  return (await provider.getStarkProfile(address))?.profilePicture ?? null;
}

export default async function resolve(domainOrAddress: string) {
  try {
    let img_url = await getImage(domainOrAddress);

    if (img_url?.startsWith('https://api.starkurabu.com')) {
      const response = await fetch(img_url);
      const data = await response.json();

      img_url = data.image;
    }

    if (!img_url) return false;

    const input = await fetchHttpImage(getUrl(img_url));

    return await resize(input, max, max);
  } catch (e) {
    return false;
  }
}
