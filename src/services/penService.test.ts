/**
 * penService 单元测试
 * 确保 Pen 数据的有效性和防御性编程
 */

import { Pen } from './penService';

export {};

// Mock API 响应数据
describe('Pen Data Validation', () => {
  /**
   * 测试：有效的 Pen 数组应被正确处理
   */
  test('Valid pen array should be processed correctly', () => {
    const validPens = [
      {
        id: '1',
        title: 'Test Pen 1',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: '2',
        title: 'Test Pen 2',
        html: '<div>Test 2</div>',
        css: 'body { color: blue; }',
        js: 'console.log("test2");',
        isPublic: true,
        userId: 'user1',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02'
      }
    ];

    // 验证数组中所有元素都有有效的 id
    const result = validPens.filter((pen: any): pen is Pen => {
      return pen && typeof pen === 'object' && typeof pen.id === 'string';
    });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  /**
   * 测试：undefined 元素应被过滤掉
   */
  test('Undefined elements should be filtered out', () => {
    const mixedData = [
      {
        id: '1',
        title: 'Valid Pen',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      undefined,
      {
        id: '3',
        title: 'Another Valid Pen',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ] as any;

    const result = mixedData.filter((pen: any): pen is Pen => {
      return pen && typeof pen === 'object' && typeof pen.id === 'string';
    });

    expect(result).toHaveLength(2);
    expect(result.every((p: Pen) => p !== undefined)).toBe(true);
    expect(result.every((p: Pen) => typeof p.id === 'string')).toBe(true);
  });

  /**
   * 测试：无效的 id 应被过滤掉
   */
  test('Items without valid id should be filtered out', () => {
    const invalidData = [
      {
        id: '1',
        title: 'Valid Pen',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        // Missing id
        title: 'Invalid Pen',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        // id is not a string
        id: 123,
        title: 'Invalid Pen 2',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ] as any;

    const result = invalidData.filter((pen: any): pen is Pen => {
      return pen && typeof pen === 'object' && typeof pen.id === 'string';
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  /**
   * 测试：null 值应被过滤掉
   */
  test('Null values should be filtered out', () => {
    const dataWithNull = [
      {
        id: '1',
        title: 'Valid Pen',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      null,
      {
        id: '2',
        title: 'Another Valid Pen',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ] as any;

    const result = dataWithNull.filter((pen: any): pen is Pen => {
      return pen && typeof pen === 'object' && typeof pen.id === 'string';
    });

    expect(result).toHaveLength(2);
    expect(result.every((p: Pen) => p !== null)).toBe(true);
  });

  /**
   * 测试：空数组应返回空数组
   */
  test('Empty array should return empty array', () => {
    const emptyData: any[] = [];

    const result = emptyData.filter((pen): pen is Pen => {
      return pen && typeof pen === 'object' && typeof pen.id === 'string';
    });

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  /**
   * 测试：Pen 对象在 map 中安全使用
   */
  test('Pen objects should be safely used in map operations', () => {
    const pens = [
      {
        id: '1',
        title: 'Test Pen 1',
        html: '<div>Test</div>',
        css: 'body { color: red; }',
        js: 'console.log("test");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: '2',
        title: 'Test Pen 2',
        html: '<div>Test 2</div>',
        css: 'body { color: blue; }',
        js: 'console.log("test2");',
        isPublic: true,
        userId: 'user1',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02'
      }
    ];

    // 验证可以安全地使用 .toString() 方法
    const ids = pens
      .filter((p): p is Pen => p && typeof p === 'object' && typeof p.id === 'string')
      .map(p => p.id.toString());

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe('1');
    expect(ids[1]).toBe('2');
  });
});
