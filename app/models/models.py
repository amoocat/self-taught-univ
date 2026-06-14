"""
Backward-compatible facade — 기존 `from app.models.models import X` 임포트를 유지하기 위한 재수출 모듈.
실제 모델 정의는 도메인별 파일에 있음:
  - app/models/curriculum.py  (Course, Lecture, LectureNote, MyNote, Progress, NoteEmbedding)
  - app/models/research.py    (Paper, PaperAnnotation, FeedItem)
  - app/models/graph.py       (GraphNode, GraphEdge)
  - app/models/chat.py        (ChatSession)
  - app/models/youtube.py     (VideoInbox)
"""
from app.models.curriculum import (  # noqa: F401
    Course,
    Lecture,
    LectureNote,
    MyNote,
    Progress,
    NoteEmbedding,
)
from app.models.research import (  # noqa: F401
    Paper,
    PaperAnnotation,
    FeedItem,
)
from app.models.graph import (  # noqa: F401
    GraphNode,
    GraphEdge,
)
from app.models.chat import ChatSession  # noqa: F401
from app.models.youtube import VideoInbox  # noqa: F401

__all__ = [
    "Course", "Lecture", "LectureNote", "MyNote", "Progress", "NoteEmbedding",
    "Paper", "PaperAnnotation", "FeedItem",
    "GraphNode", "GraphEdge",
    "ChatSession",
    "VideoInbox",
]
