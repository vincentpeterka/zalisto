import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateIp, isAllowedScheme } from './fetcher.js'

describe('isPrivateIp', () => {
  it('blocks loopback 127.x', () => {
    assert.equal(isPrivateIp('127.0.0.1'), true)
    assert.equal(isPrivateIp('127.255.255.255'), true)
  })

  it('blocks private 10.x', () => {
    assert.equal(isPrivateIp('10.0.0.1'), true)
    assert.equal(isPrivateIp('10.255.255.255'), true)
  })

  it('blocks private 192.168.x', () => {
    assert.equal(isPrivateIp('192.168.0.1'), true)
    assert.equal(isPrivateIp('192.168.255.255'), true)
  })

  it('blocks private 172.16-31.x', () => {
    assert.equal(isPrivateIp('172.16.0.1'), true)
    assert.equal(isPrivateIp('172.31.255.255'), true)
    assert.equal(isPrivateIp('172.15.0.1'), false) // just outside range
    assert.equal(isPrivateIp('172.32.0.1'), false) // just outside range
  })

  it('blocks link-local 169.254.x', () => {
    assert.equal(isPrivateIp('169.254.0.1'), true)
    assert.equal(isPrivateIp('169.254.169.254'), true) // AWS metadata
  })

  it('blocks cloud metadata IP', () => {
    assert.equal(isPrivateIp('100.100.100.200'), true)
  })

  it('blocks IPv6 loopback', () => {
    assert.equal(isPrivateIp('::1'), true)
  })

  it('blocks IPv6 ULA fc00:', () => {
    assert.equal(isPrivateIp('fc00::1'), true)
  })

  it('blocks IPv6 link-local fe80:', () => {
    assert.equal(isPrivateIp('fe80::1'), true)
  })

  it('allows public IPs', () => {
    assert.equal(isPrivateIp('1.1.1.1'), false)
    assert.equal(isPrivateIp('8.8.8.8'), false)
    assert.equal(isPrivateIp('93.184.216.34'), false) // example.com
    assert.equal(isPrivateIp('2606:2800:21f:cb07:6820:80da:af6b:8b2c'), false) // example.com IPv6
  })
})

describe('isAllowedScheme', () => {
  it('allows http:', () => assert.equal(isAllowedScheme('http:'), true))
  it('allows https:', () => assert.equal(isAllowedScheme('https:'), true))
  it('rejects ftp:', () => assert.equal(isAllowedScheme('ftp:'), false))
  it('rejects file:', () => assert.equal(isAllowedScheme('file:'), false))
  it('rejects javascript:', () => assert.equal(isAllowedScheme('javascript:'), false))
  it('rejects data:', () => assert.equal(isAllowedScheme('data:'), false))
  it('rejects empty string', () => assert.equal(isAllowedScheme(''), false))
})
