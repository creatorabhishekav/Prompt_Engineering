import logging
from typing import Any, Dict, List, Optional
from app.db.firestore import get_firestore_db

logger = logging.getLogger("app.db.crud")

# In-Memory cache/store fallback
_LOCAL_USERS: Dict[str, Dict[str, Any]] = {}
_LOCAL_COMPETITIONS: Dict[str, Dict[str, Any]] = {}
_LOCAL_ROUNDS: Dict[str, Dict[str, Any]] = {}
_LOCAL_TARGET_IMAGES: Dict[str, List[Dict[str, Any]]] = {}
_LOCAL_SUBMISSIONS: Dict[str, Dict[str, Any]] = {}
_LOCAL_SCORES: Dict[str, Dict[str, Any]] = {}

class FirestoreCRUD:
    # Users
    @staticmethod
    def get_user(uid: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                doc = db.collection("users").document(uid).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.warning(f"Firestore get_user error: {e}")
        return _LOCAL_USERS.get(uid)

    @staticmethod
    def save_user(data: Dict[str, Any]) -> Dict[str, Any]:
        uid = data.get("uid") or data.get("id")
        _LOCAL_USERS[uid] = data
        db = get_firestore_db()
        if db:
            try:
                db.collection("users").document(uid).set(data, merge=True)
            except Exception as e:
                logger.warning(f"Firestore save_user error: {e}")
        return data

    @staticmethod
    def list_users() -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("users").stream()
                results = [d.to_dict() for d in docs]
                if results:
                    return results
            except Exception as e:
                logger.warning(f"Firestore list_users error: {e}")
        return list(_LOCAL_USERS.values())

    # Competitions
    @staticmethod
    def get_competition(comp_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                doc = db.collection("competitions").document(comp_id).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.warning(f"Firestore get_competition error: {e}")
        return _LOCAL_COMPETITIONS.get(comp_id)

    @staticmethod
    def create_competition(data: Dict[str, Any]) -> Dict[str, Any]:
        cid = data["id"]
        _LOCAL_COMPETITIONS[cid] = data
        db = get_firestore_db()
        if db:
            try:
                db.collection("competitions").document(cid).set(data)
            except Exception as e:
                logger.warning(f"Firestore create_competition error: {e}")
        return data

    @staticmethod
    def update_competition(comp_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        comp = FirestoreCRUD.get_competition(comp_id)
        if not comp:
            return None
        comp.update(updates)
        _LOCAL_COMPETITIONS[comp_id] = comp
        db = get_firestore_db()
        if db:
            try:
                db.collection("competitions").document(comp_id).update(updates)
            except Exception as e:
                logger.warning(f"Firestore update_competition error: {e}")
        return comp

    @staticmethod
    def list_competitions() -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("competitions").stream()
                res = [d.to_dict() for d in docs]
                if res:
                    return res
            except Exception as e:
                logger.warning(f"Firestore list_competitions error: {e}")
        return list(_LOCAL_COMPETITIONS.values())

    # Rounds
    @staticmethod
    def get_round(round_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                doc = db.collection("rounds").document(round_id).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.warning(f"Firestore get_round error: {e}")
        return _LOCAL_ROUNDS.get(round_id)

    @staticmethod
    def create_round(data: Dict[str, Any]) -> Dict[str, Any]:
        rid = data["id"]
        _LOCAL_ROUNDS[rid] = data
        db = get_firestore_db()
        if db:
            try:
                db.collection("rounds").document(rid).set(data)
            except Exception as e:
                logger.warning(f"Firestore create_round error: {e}")
        return data

    @staticmethod
    def update_round(round_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rnd = FirestoreCRUD.get_round(round_id)
        if not rnd:
            return None
        rnd.update(updates)
        _LOCAL_ROUNDS[round_id] = rnd
        db = get_firestore_db()
        if db:
            try:
                db.collection("rounds").document(round_id).update(updates)
            except Exception as e:
                logger.warning(f"Firestore update_round error: {e}")
        return rnd

    @staticmethod
    def list_all_rounds() -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("rounds").stream()
                res = [d.to_dict() for d in docs]
                if res:
                    return res
            except Exception as e:
                logger.warning(f"Firestore list_all_rounds error: {e}")
        return list(_LOCAL_ROUNDS.values())

    @staticmethod
    def list_rounds_for_competition(comp_id: str) -> List[Dict[str, Any]]:
        all_r = FirestoreCRUD.list_all_rounds()
        return [r for r in all_r if r.get("competition_id") == comp_id]

    # Target Images
    @staticmethod
    def get_target_image_by_round(round_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("target_images").where("round_id", "==", round_id).stream()
                for d in docs:
                    return d.to_dict()
            except Exception as e:
                logger.warning(f"Firestore get_target_image error: {e}")
        images = _LOCAL_TARGET_IMAGES.get(round_id, [])
        return images[0] if images else None

    @staticmethod
    def list_target_images(round_id: str) -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("target_images").where("round_id", "==", round_id).stream()
                res = [d.to_dict() for d in docs]
                if res:
                    return res
            except Exception as e:
                logger.warning(f"Firestore list_target_images error: {e}")
        return _LOCAL_TARGET_IMAGES.get(round_id, [])

    @staticmethod
    def create_target_image(data: Dict[str, Any]) -> Dict[str, Any]:
        rid = data["round_id"]
        current = _LOCAL_TARGET_IMAGES.get(rid, [])
        current.append(data)
        _LOCAL_TARGET_IMAGES[rid] = current
        db = get_firestore_db()
        if db:
            try:
                db.collection("target_images").document(data["id"]).set(data)
            except Exception as e:
                logger.warning(f"Firestore create_target_image error: {e}")
        return data

    # Submissions
    @staticmethod
    def get_submission(sub_id: str) -> Optional[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                doc = db.collection("submissions").document(sub_id).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.warning(f"Firestore get_submission error: {e}")
        return _LOCAL_SUBMISSIONS.get(sub_id)

    @staticmethod
    def get_submission_by_user_and_round(user_id: str, round_id: str) -> Optional[Dict[str, Any]]:
        all_subs = FirestoreCRUD.list_all_submissions()
        for s in all_subs:
            if s.get("user_id") == user_id and s.get("round_id") == round_id:
                return s
        return None

    @staticmethod
    def create_submission(data: Dict[str, Any]) -> Dict[str, Any]:
        sid = data["id"]
        _LOCAL_SUBMISSIONS[sid] = data
        db = get_firestore_db()
        if db:
            try:
                db.collection("submissions").document(sid).set(data)
            except Exception as e:
                logger.warning(f"Firestore create_submission error: {e}")
        return data

    @staticmethod
    def update_submission(sub_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        sub = FirestoreCRUD.get_submission(sub_id)
        if not sub:
            return None
        sub.update(updates)
        _LOCAL_SUBMISSIONS[sub_id] = sub
        db = get_firestore_db()
        if db:
            try:
                db.collection("submissions").document(sub_id).update(updates)
            except Exception as e:
                logger.warning(f"Firestore update_submission error: {e}")
        return sub

    @staticmethod
    def list_all_submissions() -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("submissions").stream()
                res = [d.to_dict() for d in docs]
                if res:
                    return res
            except Exception as e:
                logger.warning(f"Firestore list_all_submissions error: {e}")
        return list(_LOCAL_SUBMISSIONS.values())

    @staticmethod
    def delete_submission(sub_id: str) -> bool:
        _LOCAL_SUBMISSIONS.pop(sub_id, None)
        db = get_firestore_db()
        if db:
            try:
                db.collection("submissions").document(sub_id).delete()
            except Exception as e:
                logger.warning(f"Firestore delete_submission error: {e}")
        return True

    # Scores
    @staticmethod
    def get_score_by_submission_and_stage(sub_id: str, stage: str) -> Optional[Dict[str, Any]]:
        all_s = FirestoreCRUD.list_scores()
        for s in all_s:
            if s.get("submission_id") == sub_id and s.get("evaluation_stage") == stage:
                return s
        return None

    @staticmethod
    def get_score_by_submission(sub_id: str) -> Optional[Dict[str, Any]]:
        all_s = FirestoreCRUD.list_scores()
        for s in all_s:
            if s.get("submission_id") == sub_id:
                return s
        return None

    @staticmethod
    def create_score(data: Dict[str, Any]) -> Dict[str, Any]:
        sid = data["id"]
        _LOCAL_SCORES[sid] = data
        db = get_firestore_db()
        if db:
            try:
                db.collection("scores").document(sid).set(data)
            except Exception as e:
                logger.warning(f"Firestore create_score error: {e}")
        return data

    @staticmethod
    def list_scores() -> List[Dict[str, Any]]:
        db = get_firestore_db()
        if db:
            try:
                docs = db.collection("scores").stream()
                res = [d.to_dict() for d in docs]
                if res:
                    return res
            except Exception as e:
                logger.warning(f"Firestore list_scores error: {e}")
        return list(_LOCAL_SCORES.values())
