import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { ens_normalize } from '@adraffy/ens-normalize';
import {
  provider as getProvider,
  graphQlCall,
  Address,
  Handle,
  isSilencedContractError,
  FetchError
} from './utils';

export const NAME = 'Ens';
const NETWORK = '1';
const provider = getProvider(NETWORK);

function normalizeHandles(names: string[]) {
  return names.map(name => {
    try {
      return ens_normalize(name) === name ? name : '';
    } catch (e) {
      return '';
    }
  });
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const abi = ['function getNames(address[] addresses) view returns (string[] r)'];

  try {
    const reverseRecords = await snapshot.utils.call(
      provider,
      abi,
      ['0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C', 'getNames', [addresses]],
      { blockTag: 'latest' }
    );
    const validNames = normalizeHandles(reverseRecords);

    return Object.fromEntries(
      addresses
        .map((address, index) => [address, validNames[index]])
        .filter((_, index) => !!validNames[index])
    );
  } catch (e) {
    if (!isSilencedContractError(e)) {
      capture(e, { input: { addresses } });
    }
    throw new FetchError();
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles).filter(h => h);

  if (normalizedHandles.length === 0) return {};

  try {
    const {
      data: {
        data: { domains: items }
      }
    } = await graphQlCall(
      'https://api.thegraph.com/subgraphs/name/ensdomains/ens',
      `query Domains {
        domains(where: {name_in: ["${normalizedHandles.join('","')}"]}) {
          name
          resolvedAddress {
            id
          }
        }
      }`
    );

    return Object.fromEntries(
      items.map(item => [
        item.name,
        item.resolvedAddress ? getAddress(item.resolvedAddress.id) : ''
      ])
    );
  } catch (e) {
    capture(e, { input: { handles } });
    throw new FetchError();
  }
}
