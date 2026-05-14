import uuid
from datetime import datetime, timezone
from services.database import get_db


def list_items(type_filter=None, tags=None, q=None, offset=0, limit=24):
    conn = get_db()
    params = []
    conditions = []

    if type_filter and type_filter != 'all':
        conditions.append("i.type = ?")
        params.append(type_filter)

    if q:
        conditions.append("(i.title LIKE ? OR i.content LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])

    where = " AND ".join(conditions) if conditions else "1=1"

    if tags:
        # When tag filtering: fetch all, filter by tag, then paginate
        items_sql = f"""
            SELECT i.* FROM items i
            WHERE {where}
            ORDER BY i.created_at DESC
        """
        all_items = conn.execute(items_sql, params).fetchall()
        result = []
        for row in all_items:
            item = dict(row)
            item['tags'] = _get_tags_for_item(conn, item['id'])
            item['tag_names'] = [t['name'] for t in item['tags']]
            if not all(tag in item['tag_names'] for tag in tags):
                continue
            result.append(item)
        total = len(result)
        result = result[offset:offset + limit]
    else:
        # Fast path: no tag filter, use SQL LIMIT/OFFSET
        count_sql = f"SELECT COUNT(*) FROM items i WHERE {where}"
        total = conn.execute(count_sql, params).fetchone()[0]

        items_sql = f"""
            SELECT i.* FROM items i
            WHERE {where}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(items_sql, params + [limit, offset]).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item['tags'] = _get_tags_for_item(conn, item['id'])
            item['tag_names'] = [t['name'] for t in item['tags']]
            result.append(item)

    conn.close()
    return result, total


def get_item(item_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if row:
        item = dict(row)
        item['tags'] = _get_tags_for_item(conn, item['id'])
        conn.close()
        return item
    conn.close()
    return None


def create_item(data):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    item_id = str(uuid.uuid4())

    conn.execute(
        """INSERT INTO items (id, type, title, content, url, language, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (item_id, data['type'], data['title'], data.get('content', ''),
         data.get('url'), data.get('language'), now, now)
    )

    # Attach tags
    tag_ids = _resolve_tags(conn, data.get('tags', []))
    for tag_id in tag_ids:
        conn.execute("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)",
                     (item_id, tag_id))

    conn.commit()
    conn.close()
    return get_item(item_id)


def update_item(item_id, data):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()

    fields = []
    params = []
    for key in ('type', 'title', 'content', 'url', 'language'):
        if key in data:
            fields.append(f"{key} = ?")
            params.append(data[key])

    if fields:
        fields.append("updated_at = ?")
        params.append(now)
        params.append(item_id)
        conn.execute(f"UPDATE items SET {', '.join(fields)} WHERE id = ?", params)

    if 'tags' in data:
        conn.execute("DELETE FROM item_tags WHERE item_id = ?", (item_id,))
        tag_ids = _resolve_tags(conn, data['tags'])
        for tag_id in tag_ids:
            conn.execute("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)",
                         (item_id, tag_id))

    conn.commit()
    conn.close()
    return get_item(item_id)


def delete_item(item_id):
    conn = get_db()
    conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()


def _get_tags_for_item(conn, item_id):
    rows = conn.execute(
        """SELECT t.* FROM tags t
           JOIN item_tags it ON t.id = it.tag_id
           WHERE it.item_id = ?
           ORDER BY t.name""",
        (item_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def _resolve_tags(conn, tag_names):
    tag_ids = []
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        existing = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
        if existing:
            tag_ids.append(existing['id'])
        else:
            tag_id = str(uuid.uuid4())
            conn.execute("INSERT INTO tags (id, name) VALUES (?, ?)", (tag_id, name))
            tag_ids.append(tag_id)
    return tag_ids
