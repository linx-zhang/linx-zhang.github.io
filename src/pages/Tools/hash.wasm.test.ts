// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hashFile } from './hash'

/**
 * 真算哈希的部分单独放 node 环境跑：hash-wasm 在 jsdom 里没有可用的 WebAssembly，
 * 而这里要验的正是「分块结果必须等于整块结果」——这是流式实现最容易错的地方。
 */

const bytesOf = (text: string): number[] => Array.from(new TextEncoder().encode(text))

describe('hashFile', () => {
  it('空文件给出标准空内容哈希（校验里最常见的对照样本）', async () => {
    const result = await hashFile(new File([], 'empty.bin'), ['md5', 'sha256'])
    expect(result.md5).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(result.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('四种算法的 abc 向量全对', async () => {
    const file = new File([new Uint8Array(bytesOf('abc'))], 'abc.txt')
    const result = await hashFile(file, ['md5', 'sha1', 'sha256', 'sha512'])
    expect(result.md5).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(result.sha1).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(result.sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(result.sha512).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
        '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    )
  })

  it('按 7 字节分块与整块一次读完结果完全相同（跨块边界不漏字节）', async () => {
    const bytes = Array.from({ length: 1000 }, (_, index) => (index * 7) % 256)
    const file = new File([new Uint8Array(bytes)], 'chunk.bin')
    const whole = await hashFile(file, ['md5', 'sha256', 'sha512'])
    const chunked = await hashFile(file, ['md5', 'sha256', 'sha512'], { chunkSize: 7 })
    expect(chunked).toEqual(whole)
  })

  it('空算法列表直接返回空结果，不启动 WASM', async () => {
    expect(await hashFile(new File([new Uint8Array([1, 2, 3])], 'x.bin'), [])).toEqual({})
  })

  it('进度回报是单调递增的，最后落在 1', async () => {
    const file = new File([new Uint8Array(Array.from({ length: 900 }, (_, i) => i % 251))], 'p.bin')
    const ratios: number[] = []
    await hashFile(file, ['sha256'], { chunkSize: 100, onProgress: (ratio) => ratios.push(ratio) })
    expect(ratios.length).toBe(9)
    expect(ratios[ratios.length - 1]).toBe(1)
    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios)
  })

  it('已取消的 signal 立刻抛 AbortError，不产出结果', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(hashFile(new File([new Uint8Array([1])], 'a.bin'), ['md5'], { signal: controller.signal })).rejects.toThrow(
      /已取消/,
    )
  })
})
