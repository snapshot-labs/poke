import { lookupAddresses } from '../../../src/addressResolvers/lens';

describe('Lens address resolver', () => {
  const validAddress = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
  const validDomain = 'fabien.lens';
  const blankAddress = '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1';

  describe('lookupAddresses()', () => {
    describe('when the address is associated to a domain', () => {
      it('returns a list of domains associated to the address', async () => {
        return expect(lookupAddresses([validAddress])).resolves.toEqual({
          [validAddress]: validDomain
        });
      }, 10e3);
    });

    describe('when the address is not associated to a domain', () => {
      it('returns an empty object', () => {
        return expect(lookupAddresses([blankAddress])).resolves.toEqual({});
      }, 10e3);
    });

    describe('when mix of addresses with and without associated domains', () => {
      it('returns an object with only addresses associated to a domain', () => {
        return expect(lookupAddresses([validAddress, blankAddress])).resolves.toEqual({
          [validAddress]: validDomain
        });
      }, 10e3);
    });

    describe('when passing invalid addresses', () => {
      it('returns an empty object', () => {
        return expect(lookupAddresses([validAddress, `${blankAddress}xxx`])).resolves.toEqual({});
      }, 10e3);
    });
  });
});
