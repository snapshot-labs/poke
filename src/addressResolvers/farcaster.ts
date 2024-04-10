import { capture } from '@snapshot-labs/snapshot-sentry';
import { graphQlCall, Address, Handle, FetchError, isSilencedError, isEvmAddress } from './utils';

export const NAME = 'Farcaster';
const FNAMES_API_URL = 'https://fnames.farcaster.xyz/transfers?name=';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/user/';
const API_KEY = process.env.NEYNAR_API_KEY ?? '';


interface UserDetails {
  username: string;
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
  pfp_url: string;
}

interface ApiResponse {
  [address: string]: UserDetails[];
}

interface UserResult {
  username?: string;
  eth_addresses?: string[];
  sol_addresses?: string[];
  pfp_url?: string;
}


async function fetchData<T>(url: string, method: string = 'GET'): Promise<T> {
  const headers = {
    Accept: 'application/json',
    api_key: API_KEY
  };
  const response = await fetch(url, { method, headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch data from the API. Status: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function lookupAddresses(
  addresses: string[]
): Promise<{ [key: string]: UserResult | string }> {
  const results: { [key: string]: UserResult | string } = {};
  try {
    const addressesQuery = addresses.join(',');
    const url = `${NEYNAR_API_URL}bulk-by-address?addresses=${addressesQuery}`;
    const userDetails = await fetchData<ApiResponse>(url);

    for (const [address, data] of Object.entries(userDetails)) {
      if (Array.isArray(data) && data.length > 0) {
        const {
          username,
          verified_addresses: { eth_addresses = [], sol_addresses = [] },
          pfp_url
        } = data[0];
        results[address] = { username, eth_addresses, sol_addresses, pfp_url };
      } else {
        results[address] = 'No user found for this address.';
      }
    }
  } catch (error) {
    console.error(`Error fetching address details:`, error);
    throw new Error(`Error fetching address details.`);
  }
  return results;
}

async function fetchUserDetailsByUsername(username: string): Promise<UserResult | null> {
  try {
    const transferData = await fetchData<{ transfers: any[] }>(`${FNAMES_API_URL}${username}`);
    if (transferData.transfers.length > 0) {
      const userDetails = await fetchData<{ result: { users: UserDetails[] } }>(
        `${NEYNAR_API_URL}search?q=${username}&viewer_fid=197049`
      );
      if (userDetails.result && userDetails.result.users.length > 0) {
        const { username, verified_addresses, pfp_url } = userDetails.result.users[0];
        return {
          eth_addresses: verified_addresses.eth_addresses,
          username
        };
      }
    }
  } catch (error) {
    console.error(`Error fetching user details for ${username}:`, error);
    throw new Error(`Error fetching user details for ${username}.`);
  }
  return null;
}

export async function resolveNames(
  handles: string[]
): Promise<{ [handle: string]: UserResult | string }> {
  const results: { [handle: string]: UserResult | string } = {};
  for (const handle of handles) {
    const normalizedHandle = handle.replace('.fcast.id', '');
    const userDetails = await fetchUserDetailsByUsername(normalizedHandle);
    if (userDetails) {
      results[handle] = userDetails;
    } else {
      results[handle] = 'User not found or error searching for details.';
    }
  }
  return results;
}
