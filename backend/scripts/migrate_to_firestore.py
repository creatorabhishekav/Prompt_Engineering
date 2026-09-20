import logging
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.crud import FirestoreCRUD
from app.models.user import User
from app.models.competition import Competition
from app.models.round import Round
from app.models.target_image import TargetImage
from app.models.submission import Submission
from app.models.score import Score

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrate_to_firestore")

def migrate():
    db = SessionLocal()
    try:
        # 1. Users
        users = db.scalars(select(User)).all()
        logger.info(f"Migrating {len(users)} users to Firestore...")
        for u in users:
            FirestoreCRUD.save_user({
                "uid": u.id,
                "email": u.email,
                "username": u.username,
                "full_name": u.full_name,
                "role": u.role.value,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "updated_at": u.updated_at.isoformat() if u.updated_at else None,
            })

        # 2. Competitions
        comps = db.scalars(select(Competition)).all()
        logger.info(f"Migrating {len(comps)} competitions to Firestore...")
        for c in comps:
            FirestoreCRUD.create_competition({
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "slug": c.slug,
                "status": c.status.value,
                "created_by": c.created_by,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            })

        # 3. Rounds
        rounds = db.scalars(select(Round)).all()
        logger.info(f"Migrating {len(rounds)} rounds to Firestore...")
        for r in rounds:
            FirestoreCRUD.create_round({
                "id": r.id,
                "competition_id": r.competition_id,
                "round_number": r.round_number,
                "title": r.title,
                "description": r.description,
                "secret_prompt": r.secret_prompt,
                "time_limit_seconds": r.time_limit_seconds,
                "status": r.status.value,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            })

        # 4. Target Images
        t_imgs = db.scalars(select(TargetImage)).all()
        logger.info(f"Migrating {len(t_imgs)} target images to Firestore...")
        for ti in t_imgs:
            FirestoreCRUD.create_target_image({
                "id": ti.id,
                "round_id": ti.round_id,
                "image_url": ti.image_url,
                "alt_text": ti.alt_text,
                "created_by": ti.created_by,
                "created_at": ti.created_at.isoformat() if ti.created_at else None,
            })

        # 5. Submissions
        subs = db.scalars(select(Submission)).all()
        logger.info(f"Migrating {len(subs)} submissions to Firestore...")
        for s in subs:
            FirestoreCRUD.create_submission({
                "id": s.id,
                "user_id": s.user_id,
                "round_id": s.round_id,
                "target_image_id": s.target_image_id,
                "image_url": s.image_url,
                "prompt_used": s.prompt_used,
                "status": s.status.value,
                "started_at_elapsed": s.started_at_elapsed,
                "deadline_elapsed": s.deadline_elapsed,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            })

        # 6. Scores
        scores = db.scalars(select(Score)).all()
        logger.info(f"Migrating {len(scores)} scores to Firestore...")
        for sc in scores:
            FirestoreCRUD.create_score({
                "id": sc.id,
                "submission_id": sc.submission_id,
                "round_id": sc.round_id,
                "user_id": sc.user_id,
                "semantic_score": sc.semantic_score,
                "composition_score": sc.composition_score,
                "objects_score": sc.objects_score,
                "color_score": sc.color_score,
                "details_score": sc.details_score,
                "total_score": sc.total_score,
                "status": sc.status.value,
                "feedback": sc.feedback,
                "created_at": sc.created_at.isoformat() if sc.created_at else None,
                "updated_at": sc.updated_at.isoformat() if sc.updated_at else None,
            })

        logger.info("Migration to Firestore complete! SQLite database preserved as backup.")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
