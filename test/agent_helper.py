"""e2e helper: plays the server side (user creation, agent writes/deletes). Uses DATABASE_URL/DATA_DIR.

  python agent_helper.py user <email>            -> {"user_id", "token"}
  python agent_helper.py write <uid> <path>      (content on stdin, utf-8)
  python agent_helper.py delete <uid> <path>
  python agent_helper.py count <uid>             -> number of vault_changes rows
  python agent_helper.py bulk <uid> <prefix> <n> (n agent files <prefix>/<i>.md, one process)
"""

from __future__ import annotations

import json
import sys

from uninotes import accounts, db
from uninotes.storage import sha256_bytes, vault_dir


def main() -> None:
    cmd = sys.argv[1]
    db.init_db()
    if cmd == "user":
        c = accounts.create_user(sys.argv[2])
        print(json.dumps({"user_id": c.user_id, "token": c.plugin_token}))
    elif cmd == "write":
        uid, rel = sys.argv[2], sys.argv[3]
        data = sys.stdin.buffer.read()
        p = vault_dir(uid) / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        before = p.read_bytes() if p.is_file() else None
        p.write_bytes(data)
        with db.session_scope() as s:
            s.add(db.ChangeLog(user_id=uid, actor="agent", op="update" if before else "create", path=rel,
                               before_sha256=sha256_bytes(before) if before else None,
                               after_sha256=sha256_bytes(data), before_content=before.decode() if before else None,
                               after_content=data.decode(), state="applied"))
            s.add(db.VaultChange(user_id=uid, path=rel, op="put", sha256=sha256_bytes(data), source="agent"))
    elif cmd == "delete":
        uid, rel = sys.argv[2], sys.argv[3]
        (vault_dir(uid) / rel).unlink()
        with db.session_scope() as s:
            s.add(db.VaultChange(user_id=uid, path=rel, op="delete", sha256=None, source="agent"))
    elif cmd == "bulk":
        uid, prefix, n = sys.argv[2], sys.argv[3], int(sys.argv[4])
        with db.session_scope() as s:
            for i in range(n):
                rel, data = f"{prefix}/{i}.md", f"filler {i}\n".encode()
                p = vault_dir(uid) / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(data)
                s.add(db.VaultChange(user_id=uid, path=rel, op="put", sha256=sha256_bytes(data), source="agent"))
    elif cmd == "count":
        from sqlalchemy import func, select

        with db.session_scope() as s:
            print(s.scalar(select(func.count()).select_from(db.VaultChange)
                           .where(db.VaultChange.user_id == sys.argv[2])))


if __name__ == "__main__":
    main()
