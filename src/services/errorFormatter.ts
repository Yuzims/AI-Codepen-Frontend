export function formatErrorMessage(raw: string, source: 'babel' | 'ts' | 'css' | 'html' | 'js'): string {
    let msg = raw;

    // 去掉 Babel/JS 常见前缀
    msg = msg
        .replace(/^SyntaxError:\s*/i, '')
        .replace(/^unknown:\s*/i, '')
        .replace(/^error\s+TS\d+:\s*/i, '')
        .replace(/\s*\(\d+:\d+\)$/, '')
        .trim();

    // 截断超过 120 字符的消息
    if (msg.length > 120) {
        msg = msg.slice(0, 117) + '...';
    }

    return msg || raw;
}
