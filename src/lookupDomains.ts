import { capture } from '@snapshot-labs/snapshot-sentry';
import { FetchError, isSilencedError } from './addressResolvers/utils';
import { Address, graphQlCall } from './utils';
import { isAddress } from '@ethersproject/address';
import constants from './constants.json';

const DEFAULT_CHAIN_ID = '1';

type Domain = {
  name: string;
  labelName?: string;
  expiryDate?: number;
};

async function fetchDomainData(domain: Domain, chainId: string): Promise<Domain> {
  const hash = domain.name.match(/\[(.*?)\]/)?.[1];

  if (!hash) return domain;

  const {
    data: { data }
  } = await graphQlCall(
    constants.ensSubgraph[chainId],
    `query Registration {
      registration(id: "0x${hash}") {
        domain {
          name
          labelName
        }
      }
    }`
  );
  const labelName = data?.registration?.domain?.labelName;

  return {
    ...domain,
    name: labelName ? domain.name.replace(`[${hash}]`, labelName) : domain.name
  };
}

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Address[]> {
  if (!isAddress(address) || !constants.ensSubgraph[chainId]) return [];

  try {
    const {
      data: {
        data: { account }
      }
    } = await graphQlCall(
      constants.ensSubgraph[chainId],
      `query Domain {
        account(id: "${address.toLowerCase()}") {
          domains {
            name
            expiryDate
          }
          wrappedDomains {
            name
            expiryDate
          }
        }
      }`
    );

    const now = (Date.now() / 1000).toFixed(0);
    const domains: Domain[] = [
      ...(account?.domains || []),
      ...(account?.wrappedDomains || [])
    ].filter(
      domain =>
        (!domain.expiryDate || domain.expiryDate === '0' || domain.expiryDate > now) &&
        !domain.name.endsWith('.addr.reverse')
    );

    return (
      (await Promise.all(domains.map(domain => fetchDomainData(domain, chainId)))).map(
        domain => domain.name
      ) || []
    );
  } catch (e) {
    console.log(e);
    if (!isSilencedError(e)) {
      capture(e, { input: { address } });
    }
    throw new FetchError();
  }
}
