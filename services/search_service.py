# 搜索逻辑已整合在 item_service.list_items() 的 q 参数中。
# 此文件保留为后续 FTS5 全文搜索扩展预留。

def highlight(text, query, max_len=200):
    """截断文本并高亮匹配关键词（返回截断后的字符串，高亮由前端处理）"""
    if not query or not text:
        return text[:max_len] if text else ''
    lower = text.lower()
    idx = lower.find(query.lower())
    if idx == -1:
        return text[:max_len]
    start = max(0, idx - 60)
    end = min(len(text), idx + len(query) + 60)
    snippet = text[start:end]
    if start > 0:
        snippet = '...' + snippet
    if end < len(text):
        snippet = snippet + '...'
    return snippet[:max_len]
