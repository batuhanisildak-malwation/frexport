import { describe, it, expect } from 'vitest';
import { assertPublicUrl, isPrivateAddress } from '../../src/server/url-guard.js';

describe('isPrivateAddress', () => {
  const priv = ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1',
    '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1'];
  for (const ip of priv) {
    it(`flags ${ip} as private`, () => { expect(isPrivateAddress(ip)).toBe(true); });
  }
  const pub = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'];
  for (const ip of pub) {
    it(`treats ${ip} as public`, () => { expect(isPrivateAddress(ip)).toBe(false); });
  }

  it('flags hex-serialized IPv4-mapped private addr ::ffff:a00:1 (10.0.0.1)', () => {
    expect(isPrivateAddress('::ffff:a00:1')).toBe(true);
  });
  it('flags hex-serialized IPv4-mapped loopback ::ffff:7f00:1 (127.0.0.1)', () => {
    expect(isPrivateAddress('::ffff:7f00:1')).toBe(true);
  });
  it('flags hex-serialized IPv4-mapped metadata ::ffff:a9fe:a9fe (169.254.169.254)', () => {
    expect(isPrivateAddress('::ffff:a9fe:a9fe')).toBe(true);
  });
});

describe('assertPublicUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/scheme/i);
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow(/scheme/i);
  });

  it('rejects credentials in the url', async () => {
    await expect(assertPublicUrl('https://user:pass@example.com')).rejects.toThrow(/credential/i);
  });

  it('rejects literal private hosts without DNS', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toThrow(/private|blocked/i);
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/private|blocked/i);
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow(/private|blocked/i);
  });

  it('rejects a hostname that resolves to a private ip', async () => {
    await expect(
      assertPublicUrl('https://sneaky.example', { resolve: async () => ['10.0.0.9'] }),
    ).rejects.toThrow(/private|blocked/i);
  });

  it('accepts a hostname that resolves to a public ip', async () => {
    await expect(
      assertPublicUrl('https://example.com', { resolve: async () => ['93.184.216.34'] }),
    ).resolves.toBeUndefined();
  });

  it('rejects an IPv4-mapped IPv6 literal pointing at a private addr', async () => {
    await expect(assertPublicUrl('http://[::ffff:10.0.0.1]/')).rejects.toThrow(/private|blocked/i);
  });

  it('blocks literal private ips when no resolver is injected (production invariant)', async () => {
    // SECURITY INVARIANT: the resolver test-seam must not weaken production.
    // With no `resolve`, literal private IPs are hard-blocked.
    await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toThrow(/private|blocked/i);
    await expect(assertPublicUrl('http://10.0.0.1/')).rejects.toThrow(/private|blocked/i);
  });

  it('routes literal ips through an injected resolver when one is provided (test seam)', async () => {
    await expect(
      assertPublicUrl('http://127.0.0.1/', { resolve: async () => ['8.8.8.8'] }),
    ).resolves.toBeUndefined();
  });
});
