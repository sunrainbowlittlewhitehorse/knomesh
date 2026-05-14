import json
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from services.database import init_db
from services.item_service import list_items, get_item, create_item, update_item, delete_item
from services.tag_service import list_tags, create_tag, rename_tag, delete_tag, get_stats
from services.search_service import highlight

app = Flask(__name__)


def api_ok(data=None, status=200):
    return jsonify({'ok': True, 'data': data}), status


def api_error(message, status=400):
    return jsonify({'ok': False, 'error': message}), status


# ---- HTML Pages ----

@app.route('/')
def index():
    tags = list_tags()
    return render_template('index.html', tags=tags, active_page='library')


@app.route('/tags')
def tags():
    tags = list_tags()
    return render_template('tags.html', tags=tags, active_page='tags')


@app.route('/stats')
def stats():
    return render_template('stats.html', active_page='stats')


# ---- Items API ----

@app.route('/api/items')
def api_list_items():
    type_filter = request.args.get('type')
    tags = request.args.getlist('tag')
    q = request.args.get('q')
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 24, type=int)
    items, total = list_items(type_filter=type_filter, tags=tags, q=q, offset=offset, limit=limit)
    has_more = (offset + limit) < total
    return api_ok({
        'items': items,
        'total': total,
        'offset': offset,
        'limit': limit,
        'has_more': has_more,
    })


@app.route('/api/items', methods=['POST'])
def api_create_item():
    data = request.get_json()
    if not data or not data.get('title') or not data.get('type'):
        return api_error('title and type are required')
    if data['type'] not in ('link', 'note', 'code'):
        return api_error('type must be link, note, or code')
    item = create_item(data)
    return api_ok(item, 201)


@app.route('/api/items/<item_id>')
def api_get_item(item_id):
    item = get_item(item_id)
    if not item:
        return api_error('item not found', 404)
    return api_ok(item)


@app.route('/api/items/<item_id>', methods=['PUT'])
def api_update_item(item_id):
    existing = get_item(item_id)
    if not existing:
        return api_error('item not found', 404)
    data = request.get_json()
    item = update_item(item_id, data)
    return api_ok(item)


@app.route('/api/items/<item_id>', methods=['DELETE'])
def api_delete_item(item_id):
    existing = get_item(item_id)
    if not existing:
        return api_error('item not found', 404)
    delete_item(item_id)
    return api_ok({'deleted': True})


# ---- Tags API ----

@app.route('/api/tags')
def api_list_tags():
    tags = list_tags()
    return api_ok(tags)


@app.route('/api/tags', methods=['POST'])
def api_create_tag():
    data = request.get_json()
    if not data or not data.get('name'):
        return api_error('name is required')
    tag = create_tag(data['name'], data.get('color', '#8f482f'))
    if tag is None:
        return api_error('tag already exists')
    return api_ok(tag, 201)


@app.route('/api/tags/<tag_id>', methods=['PUT'])
def api_rename_tag(tag_id):
    data = request.get_json()
    if not data or not data.get('name'):
        return api_error('name is required')
    tag = rename_tag(tag_id, data['name'])
    if tag is None:
        return api_error('tag name already exists or not found')
    return api_ok(tag)


@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def api_delete_tag(tag_id):
    delete_tag(tag_id)
    return api_ok({'deleted': True})


# ---- Stats API ----

@app.route('/api/stats')
def api_stats():
    return api_ok(get_stats())


# ---- Export / Import ----

@app.route('/api/export')
def api_export():
    from services.database import get_db
    conn = get_db()
    items = conn.execute(
        "SELECT id, type, title, content, url, language, created_at, updated_at FROM items ORDER BY created_at"
    ).fetchall()
    tags = conn.execute("SELECT * FROM tags").fetchall()
    item_tags = conn.execute("SELECT * FROM item_tags").fetchall()
    conn.close()
    return api_ok({
        'version': '1.0',
        'exported_at': datetime.now().isoformat(),
        'items': [dict(i) for i in items],
        'tags': [dict(t) for t in tags],
        'item_tags': [dict(it) for it in item_tags],
    })


@app.route('/api/import', methods=['POST'])
def api_import():
    data = request.get_json()
    if not data or 'items' not in data:
        return api_error('invalid import format')
    from services.database import get_db
    conn = get_db()
    imported = 0
    for item in data.get('items', []):
        conn.execute(
            """INSERT OR REPLACE INTO items (id, type, title, content, url, language, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (item['id'], item['type'], item['title'], item.get('content', ''),
             item.get('url'), item.get('language'), item['created_at'], item['updated_at'])
        )
        imported += 1
    conn.commit()
    conn.close()
    return api_ok({'imported': imported})


# ---- Startup ----

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
