import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/ens';
import testAddressResolver from './utils';

testAddressResolver(
  'ENS',
  lookupAddresses,
  resolveNames,
  '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
  'sdntestens.eth',
  '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  ['domain.crypto', 'domain.lens', 'domain.com']
);
