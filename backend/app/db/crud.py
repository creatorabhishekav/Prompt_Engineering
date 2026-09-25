import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import logging

from app.db.firestore import get_firestore_db
from app.models.domain_enums import UserRole, LifecycleStatus, SubmissionStatus, ScoringStatus

logger = logging.getLogger("app.db.crud")

# In-memory store for fallback/testing when live Firestore is unavailable
_memory_db = {
    "users": {},
    "competitions": {},
    "rounds": {},
    "target_images": {},
    "submissions": {},
    "scores": {},
}

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class FirestoreCRUD:
    @staticmethod
    def _is_live() -> bool:
        return get_firestore_db() is not None

    # --- USER ---
    @classmethod
    def get_user(cls, uid: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            doc = db.collection("users").document(uid).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
            return None
        return _memory_db["users"].get(uid)

    @classmethod
    def get_user_by_email(cls, email: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = list(db.collection("users").where("email", "==", email).limit(1).stream())
            if docs:
                data = docs[0].to_dict()
                data["id"] = docs[0].id
                return data
            return None
        for u in _memory_db["users"].values():
            if u.get("email") == email:
                return u
        return None

    @classmethod
    def save_user(cls, user_data: Dict[str, Any]) -> Dict[str, Any]:
        uid = user_data["uid"]
        user_data["id"] = uid
        if "role" not in user_data:
            user_data["role"] = UserRole.PARTICIPANT.value
        if "is_active" not in user_data:
            user_data["is_active"] = True
        if "createdAt" not in user_data and "created_at" not in user_data:
            user_data["createdAt"] = now_iso()
            user_data["created_at"] = user_data["createdAt"]
        user_data["updatedAt"] = now_iso()
        user_data["updated_at"] = user_data["updatedAt"]

        db = get_firestore_db()
        if db:
            db.collection("users").document(uid).set(user_data, merge=True)
        _memory_db["users"][uid] = user_data
        return user_data

    @classmethod
    def list_users(cls) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("users").stream()
            return [dict(d.to_dict(), id=d.id) for d in docs]
        return list(_memory_db["users"].values())

    # --- COMPETITION ---
    @classmethod
    def create_competition(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        cid = data.get("id") or str(uuid.uuid4())
        data["id"] = cid
        data["created_at"] = data.get("created_at") or now_iso()
        data["updated_at"] = now_iso()
        if "status" not in data:
            data["status"] = LifecycleStatus.DRAFT.value
        if "is_archived" not in data:
            data["is_archived"] = False

        db = get_firestore_db()
        if db:
            db.collection("competitions").document(cid).set(data)
        _memory_db["competitions"][cid] = data
        return data

    @classmethod
    def get_competition(cls, cid: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            doc = db.collection("competitions").document(cid).get()
            if doc.exists:
                return dict(doc.to_dict(), id=doc.id)
            return None
        return _memory_db["competitions"].get(cid)

    @classmethod
    def get_active_competition(cls) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = list(db.collection("competitions").where("status", "==", LifecycleStatus.ACTIVE.value).where("is_archived", "==", False).limit(1).stream())
            if docs:
                return dict(docs[0].to_dict(), id=docs[0].id)
            return None
        for c in _memory_db["competitions"].values():
            if c.get("status") == LifecycleStatus.ACTIVE.value and not c.get("is_archived", False):
                return c
        return None

    @classmethod
    def list_competitions(cls, include_archived: bool = True) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("competitions").stream()
            res = [dict(d.to_dict(), id=d.id) for d in docs]
        else:
            res = list(_memory_db["competitions"].values())
        
        if not include_archived:
            res = [c for c in res if not c.get("is_archived", False)]
        return res

    @classmethod
    def update_competition(cls, cid: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        comp = cls.get_competition(cid)
        if not comp:
            return None
        updates["updated_at"] = now_iso()
        comp.update(updates)
        db = get_firestore_db()
        if db:
            db.collection("competitions").document(cid).update(updates)
        _memory_db["competitions"][cid] = comp
        return comp

    # --- ROUND ---
    @classmethod
    def create_round(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        rid = data.get("id") or str(uuid.uuid4())
        data["id"] = rid
        data["created_at"] = data.get("created_at") or now_iso()
        data["updated_at"] = now_iso()
        if "status" not in data:
            data["status"] = LifecycleStatus.DRAFT.value
        if "is_archived" not in data:
            data["is_archived"] = False

        db = get_firestore_db()
        if db:
            db.collection("rounds").document(rid).set(data)
        _memory_db["rounds"][rid] = data
        return data

    @classmethod
    def get_round(cls, rid: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            doc = db.collection("rounds").document(rid).get()
            if doc.exists:
                return dict(doc.to_dict(), id=doc.id)
            return None
        return _memory_db["rounds"].get(rid)

    @classmethod
    def get_active_round(cls, competition_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            query = db.collection("rounds").where("status", "==", LifecycleStatus.ACTIVE.value).where("is_archived", "==", False)
            if competition_id:
                query = query.where("competition_id", "==", competition_id)
            docs = list(query.limit(1).stream())
            if docs:
                return dict(docs[0].to_dict(), id=docs[0].id)
            return None
        for r in _memory_db["rounds"].values():
            if r.get("status") == LifecycleStatus.ACTIVE.value and not r.get("is_archived", False):
                if not competition_id or r.get("competition_id") == competition_id:
                    return r
        return None

    @classmethod
    def list_rounds_for_competition(cls, competition_id: str, include_archived: bool = True) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("rounds").where("competition_id", "==", competition_id).stream()
            res = [dict(d.to_dict(), id=d.id) for d in docs]
        else:
            res = [r for r in _memory_db["rounds"].values() if r.get("competition_id") == competition_id]
        
        if not include_archived:
            res = [r for r in res if not r.get("is_archived", False)]
        return res

    @classmethod
    def list_all_rounds(cls) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("rounds").stream()
            return [dict(d.to_dict(), id=d.id) for d in docs]
        return list(_memory_db["rounds"].values())

    @classmethod
    def update_round(cls, rid: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rnd = cls.get_round(rid)
        if not rnd:
            return None
        updates["updated_at"] = now_iso()
        rnd.update(updates)
        db = get_firestore_db()
        if db:
            db.collection("rounds").document(rid).update(updates)
        _memory_db["rounds"][rid] = rnd
        return rnd

    # --- TARGET IMAGE ---
    @classmethod
    def create_target_image(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        ti_id = data.get("id") or str(uuid.uuid4())
        data["id"] = ti_id
        data["created_at"] = data.get("created_at") or now_iso()

        db = get_firestore_db()
        if db:
            db.collection("target_images").document(ti_id).set(data)
        _memory_db["target_images"][ti_id] = data
        return data

    @classmethod
    def get_target_image_by_round(cls, round_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = list(db.collection("target_images").where("round_id", "==", round_id).limit(1).stream())
            if docs:
                return dict(docs[0].to_dict(), id=docs[0].id)
            return None
        for ti in _memory_db["target_images"].values():
            if ti.get("round_id") == round_id:
                return ti
        return None

    # --- SUBMISSION ---
    @classmethod
    def create_submission(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        sub_id = data.get("id") or str(uuid.uuid4())
        data["id"] = sub_id
        data["created_at"] = data.get("created_at") or now_iso()
        data["updated_at"] = now_iso()
        if "status" not in data:
            data["status"] = SubmissionStatus.IN_PROGRESS.value

        db = get_firestore_db()
        if db:
            db.collection("submissions").document(sub_id).set(data)
        _memory_db["submissions"][sub_id] = data
        return data

    @classmethod
    def get_submission(cls, sub_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            doc = db.collection("submissions").document(sub_id).get()
            if doc.exists:
                return dict(doc.to_dict(), id=doc.id)
            return None
        return _memory_db["submissions"].get(sub_id)

    @classmethod
    def get_submission_by_round_and_user(cls, round_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = list(db.collection("submissions").where("round_id", "==", round_id).where("user_id", "==", user_id).limit(1).stream())
            if docs:
                return dict(docs[0].to_dict(), id=docs[0].id)
            return None
        for s in _memory_db["submissions"].values():
            if s.get("round_id") == round_id and s.get("user_id") == user_id:
                return s
        return None

    @classmethod
    def update_submission(cls, sub_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        sub = cls.get_submission(sub_id)
        if not sub:
            return None
        updates["updated_at"] = now_iso()
        sub.update(updates)
        db = get_firestore_db()
        if db:
            db.collection("submissions").document(sub_id).update(updates)
        _memory_db["submissions"][sub_id] = sub
        return sub

    @classmethod
    def list_submissions_for_user(cls, user_id: str) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("submissions").where("user_id", "==", user_id).stream()
            return [dict(d.to_dict(), id=d.id) for d in docs]
        return [s for s in _memory_db["submissions"].values() if s.get("user_id") == user_id]

    @classmethod
    def list_submissions_for_round(cls, round_id: str) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("submissions").where("round_id", "==", round_id).stream()
            return [dict(d.to_dict(), id=d.id) for d in docs]
        return [s for s in _memory_db["submissions"].values() if s.get("round_id") == round_id]

    @classmethod
    def list_all_submissions(cls) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("submissions").stream()
            return [dict(d.to_dict(), id=d.id) for d in docs]
        return list(_memory_db["submissions"].values())

    # --- SCORE ---
    @classmethod
    def create_score(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        score_id = data.get("id") or str(uuid.uuid4())
        data["id"] = score_id
        data["created_at"] = data.get("created_at") or now_iso()
        data["updated_at"] = now_iso()

        db = get_firestore_db()
        if db:
            db.collection("scores").document(score_id).set(data)
        _memory_db["scores"][score_id] = data
        return data

    @classmethod
    def get_score_by_submission(cls, submission_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = list(db.collection("scores").where("submission_id", "==", submission_id).limit(1).stream())
            if docs:
                return dict(docs[0].to_dict(), id=docs[0].id)
            return None
        for sc in _memory_db["scores"].values():
            if sc.get("submission_id") == submission_id:
                return sc
        return None

    @classmethod
    def list_scores(cls) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            docs = db.collection("scores").stream()
            return [dict(d.to_dict(), id=d.id) for d in docs]
        return list(_memory_db["scores"].values())

    @classmethod
    def delete_submission(cls, sub_id: str) -> bool:
        db = get_firestore_db()
        if db:
            doc_ref = db.collection("submissions").document(sub_id)
            if not doc_ref.get().exists:
                return False
            doc_ref.delete()
        if sub_id in _memory_db["submissions"]:
            del _memory_db["submissions"][sub_id]
        return True

    @classmethod
    def delete_score(cls, score_id: str) -> bool:
        db = get_firestore_db()
        if db:
            doc_ref = db.collection("scores").document(score_id)
            if not doc_ref.get().exists:
                return False
            doc_ref.delete()
        if score_id in _memory_db["scores"]:
            del _memory_db["scores"][score_id]
        return True

    @classmethod
    def delete_score_by_submission(cls, submission_id: str) -> None:
        sc = cls.get_score_by_submission(submission_id)
        if sc and sc.get("id"):
            cls.delete_score(sc["id"])



