import axios from 'axios';
import { getUrl, resize } from '../utils';
import { max } from '../constants.json';
import { fetchHttpImage, axiosDefaultParams } from './utils';

async function getImageFromDomain(domain: string): Promise<string> {
  const res = await axios.get(
    `https://api.starknet.id/domain_to_data?domain=${domain}`,
    axiosDefaultParams
  );
  return res.data.img_url;
}

async function getImageFromAddress(address: string): Promise<string> {
  const tokenIdRes = await axios.get(
    `https://api.starknet.id/addr_to_token_id?addr=${address}`,
    axiosDefaultParams
  );
  const tokenId = tokenIdRes.data.token_id;

  if (tokenId) {
    const res = await axios.get(
      `https://api.starknet.id/id_to_data?id=${tokenId}`,
      axiosDefaultParams
    );
    return res.data.img_url;
  }

  throw new Error('No image found for starknet address');
}

function isStarknetAddress(address: string): boolean {
  return /^0x[a-f0-9]{64}$/i.test(address);
}

function isStarknetDomain(domain: string): boolean {
  return domain.endsWith('.stark');
}

export default async function resolve(domainOrAddress: string) {
  try {
    let img_url: string | null = null;
    if (isStarknetDomain(domainOrAddress)) {
      img_url = await getImageFromDomain(domainOrAddress);
    } else if (isStarknetAddress(domainOrAddress)) {
      img_url = await getImageFromAddress(domainOrAddress);
    }

    if (!img_url) {
      throw new Error('No starknet image found');
    }

    const input = await fetchHttpImage(getUrl(img_url));
    return await resize(input, max, max);
  } catch (e) {
    return false;
  }
}
