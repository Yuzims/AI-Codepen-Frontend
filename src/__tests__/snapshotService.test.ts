/**
 * snapshotService 测试用例（手动验证 / 未来接入 vitest 后可直接运行）
 *
 * 测试点：
 * 1. createSnapshot 正确生成带时间戳的快照对象
 * 2. createSnapshot 不传 traceId 时为 undefined
 * 3. formatSnapshotTime 格式化为 HH:MM:SS
 */

import { createSnapshot, formatSnapshotTime, PenSnapshot } from '../services/snapshotService';

// --- Test 1: createSnapshot 生成完整快照 ---
function testCreateSnapshotFull() {
    const params = {
        html: '<div>test</div>',
        css: 'body { color: red; }',
        js: 'console.log("hi")',
        cssLanguage: 'css' as const,
        jsLanguage: 'js' as const,
        patchSummary: '修改了颜色',
        patchTargets: ['css' as const],
        traceId: 'trace-123'
    };

    const snapshot = createSnapshot(params);

    console.assert(snapshot.html === params.html, 'html should match');
    console.assert(snapshot.css === params.css, 'css should match');
    console.assert(snapshot.js === params.js, 'js should match');
    console.assert(snapshot.cssLanguage === 'css', 'cssLanguage should be css');
    console.assert(snapshot.jsLanguage === 'js', 'jsLanguage should be js');
    console.assert(snapshot.patchSummary === '修改了颜色', 'patchSummary should match');
    console.assert(snapshot.patchTargets[0] === 'css', 'patchTargets should contain css');
    console.assert(snapshot.traceId === 'trace-123', 'traceId should match');
    console.assert(typeof snapshot.timestamp === 'number', 'timestamp should be number');
    console.assert(snapshot.timestamp > 0, 'timestamp should be positive');
    console.log('[PASS] testCreateSnapshotFull');
}

// --- Test 2: createSnapshot 不传 traceId ---
function testCreateSnapshotWithoutTraceId() {
    const snapshot = createSnapshot({
        html: '<p>hi</p>',
        css: '',
        js: '',
        cssLanguage: 'scss',
        jsLanguage: 'react',
        patchSummary: 'added component',
        patchTargets: ['html', 'js']
    });

    console.assert(snapshot.traceId === undefined, 'traceId should be undefined');
    console.assert(snapshot.cssLanguage === 'scss', 'cssLanguage should be scss');
    console.assert(snapshot.jsLanguage === 'react', 'jsLanguage should be react');
    console.assert(snapshot.patchTargets.length === 2, 'patchTargets should have 2 items');
    console.log('[PASS] testCreateSnapshotWithoutTraceId');
}

// --- Test 3: formatSnapshotTime 格式化 ---
function testFormatSnapshotTime() {
    const date = new Date(2026, 0, 15, 14, 32, 5);
    const result = formatSnapshotTime(date.getTime());
    console.assert(result === '14:32:05', `expected 14:32:05, got ${result}`);

    const date2 = new Date(2026, 0, 1, 9, 5, 3);
    const result2 = formatSnapshotTime(date2.getTime());
    console.assert(result2 === '09:05:03', `expected 09:05:03, got ${result2}`);

    const date3 = new Date(2026, 0, 1, 0, 0, 0);
    const result3 = formatSnapshotTime(date3.getTime());
    console.assert(result3 === '00:00:00', `expected 00:00:00, got ${result3}`);

    console.log('[PASS] testFormatSnapshotTime');
}

// --- Test 4: 快照时间戳在合理范围内 ---
function testSnapshotTimestampRange() {
    const before = Date.now();
    const snapshot = createSnapshot({
        html: '',
        css: '',
        js: '',
        cssLanguage: 'css',
        jsLanguage: 'js',
        patchSummary: 'test',
        patchTargets: ['html']
    });
    const after = Date.now();

    console.assert(snapshot.timestamp >= before, 'timestamp should be >= before');
    console.assert(snapshot.timestamp <= after, 'timestamp should be <= after');
    console.log('[PASS] testSnapshotTimestampRange');
}

// 运行所有测试
export function runAllSnapshotTests() {
    testCreateSnapshotFull();
    testCreateSnapshotWithoutTraceId();
    testFormatSnapshotTime();
    testSnapshotTimestampRange();
    console.log('[snapshotService] All tests passed!');
}

test('snapshotService smoke test', () => {
    const snapshot = createSnapshot({
        html: '<div>smoke</div>',
        css: '',
        js: '',
        cssLanguage: 'css',
        jsLanguage: 'js',
        patchSummary: 'smoke',
        patchTargets: ['html']
    });

    expect(snapshot.html).toBe('<div>smoke</div>');
    expect(formatSnapshotTime(snapshot.timestamp).length).toBe(8);
});

