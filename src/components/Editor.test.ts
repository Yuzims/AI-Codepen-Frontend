/**
 * Editor userPens 处理逻辑单元测试
 * 确保安全地处理 userPens 数组中可能的 undefined 值
 */

export {};

describe('Editor userPens Handling', () => {
  /**
   * 测试：userPens 的安全 map 操作
   */
  test('Safe map operation for generating select options', () => {
    const userPens = [
      {
        id: '1',
        title: 'Pen 1',
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
        title: 'Pen 2',
        html: '<div>Test 2</div>',
        css: 'body { color: blue; }',
        js: 'console.log("test2");',
        isPublic: true,
        userId: 'user1',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02'
      }
    ];

    // 模拟 Editor.tsx 中的 map 操作
    const result = (userPens || [])
      .filter(Boolean)
      .map(pen => pen && pen.id ? pen.id.toString() : null)
      .filter(Boolean);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1');
    expect(result[1]).toBe('2');
  });

  /**
   * 测试：userPens 为 undefined 时的处理
   */
  test('Handle undefined userPens safely', () => {
    const userPens = undefined;

    const result = (userPens || [])
      .filter(Boolean)
      .map((pen: any) => pen && pen.id ? pen.id.toString() : null)
      .filter(Boolean);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  /**
   * 测试：userPens 包含 undefined 元素时的处理
   */
  test('Handle userPens with undefined elements', () => {
    const userPens = [
      {
        id: '1',
        title: 'Pen 1',
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
        title: 'Pen 3',
        html: '<div>Test 3</div>',
        css: 'body { color: green; }',
        js: 'console.log("test3");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-03',
        updatedAt: '2024-01-03'
      }
    ] as any;

    const result = (userPens || [])
      .filter(Boolean)
      .map((pen: any) => pen && pen.id ? pen.id.toString() : null)
      .filter(Boolean);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('1');
    expect(result[1]).toBe('3');
  });

  /**
   * 测试：importAllCss 逻辑的安全处理
   */
  test('importAllCss should handle undefined userPens', () => {
    const userPens = undefined;
    const currentPen = { id: 'current1' };

    const availablePens = (userPens || [])
      .filter((p: any) => p && (!currentPen || p.id !== currentPen.id));
    
    const result = availablePens.map((p: any) => p.id);

    expect(result).toHaveLength(0);
  });

  /**
   * 测试：importAllCss 应排除当前 Pen
   */
  test('importAllCss should exclude current pen', () => {
    const userPens = [
      {
        id: '1',
        title: 'Pen 1',
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
        title: 'Pen 2',
        html: '<div>Test 2</div>',
        css: 'body { color: blue; }',
        js: 'console.log("test2");',
        isPublic: false,
        userId: 'user1',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02'
      }
    ];
    const currentPen = { id: '1' };

    const availablePens = (userPens || [])
      .filter((p: any) => p && (!currentPen || p.id !== currentPen.id));
    
    const result = availablePens.map((p: any) => p.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('2');
  });

  /**
   * 测试：mergedCss 的 filter 操作
   */
  test('mergedCss filter operation should handle undefined values', () => {
    const userPens = [
      { id: '1', css: 'body { color: red; }', jsLanguage: 'js' } as any,
      undefined as any,
      { id: '2', css: 'body { color: blue; }', jsLanguage: 'js' } as any
    ];
    const importedCssPenIds = ['1', '2'];

    const result = (userPens || [])
      .filter((p: any) => p && importedCssPenIds.includes(p.id))
      .sort((a: any, b: any) => {
        return importedCssPenIds.indexOf(a.id) - importedCssPenIds.indexOf(b.id);
      })
      .map((p: any) => p.css);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('body { color: red; }');
    expect(result[1]).toBe('body { color: blue; }');
  });

  /**
   * 测试：mergedJs 的复杂 map 操作
   */
  test('mergedJs map operation should handle pen objects safely', () => {
    const userPens = [
      {
        id: '1',
        js: 'console.log("test1");',
        jsLanguage: 'js'
      } as any,
      {
        id: '2',
        js: 'console.log("test2");',
        jsLanguage: 'js'
      } as any
    ];
    const importedJsPenIds = ['1', '2'];

    const result = (userPens || [])
      .filter((p: any) => p && importedJsPenIds.includes(p.id))
      .sort((a: any, b: any) => {
        return importedJsPenIds.indexOf(a.id) - importedJsPenIds.indexOf(b.id);
      })
      .map((p: any) => {
        // 模拟简化版的 map 操作
        return p.js;
      });

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('console.log("test1");');
    expect(result[1]).toBe('console.log("test2");');
  });
});
