import uuid
from services.database import get_db


def list_tags():
    conn = get_db()
    rows = conn.execute(
        """SELECT t.*, COUNT(it.item_id) as item_count
           FROM tags t
           LEFT JOIN item_tags it ON t.id = it.tag_id
           GROUP BY t.id
           ORDER BY item_count DESC, t.name"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_tag(name, color='#8f482f'):
    conn = get_db()
    tag_id = str(uuid.uuid4())
    try:
        conn.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)",
                     (tag_id, name, color))
        conn.commit()
        tag = dict(conn.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone())
        conn.close()
        return tag
    except Exception:
        conn.close()
        return None


def rename_tag(tag_id, new_name):
    conn = get_db()
    try:
        conn.execute("UPDATE tags SET name = ? WHERE id = ?", (new_name, tag_id))
        conn.commit()
        tag = dict(conn.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone())
        conn.close()
        return tag
    except Exception:
        conn.close()
        return None


def delete_tag(tag_id):
    conn = get_db()
    conn.execute("DELETE FROM item_tags WHERE tag_id = ?", (tag_id,))
    conn.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    conn.commit()
    conn.close()


def get_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    by_type = conn.execute(
        "SELECT type, COUNT(*) as count FROM items GROUP BY type"
    ).fetchall()
    by_type = {r['type']: r['count'] for r in by_type}

    recent_days = conn.execute(
        """SELECT DATE(created_at) as day, COUNT(*) as count
           FROM items WHERE created_at >= DATE('now', '-7 days')
           GROUP BY day ORDER BY day DESC"""
    ).fetchall()
    recent_days = [dict(r) for r in recent_days]

    top_tags = conn.execute(
        """SELECT t.name, COUNT(it.item_id) as count
           FROM tags t
           JOIN item_tags it ON t.id = it.tag_id
           GROUP BY t.id
           ORDER BY count DESC
           LIMIT 10"""
    ).fetchall()
    top_tags = [dict(r) for r in top_tags]

    conn.close()
    return {
        'total': total,
        'by_type': by_type,
        'recent': recent_days,
        'top_tags': top_tags,
    }
