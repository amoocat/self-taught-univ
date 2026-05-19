"""
Course / Lecture 초기 데이터 삽입
- 이미 데이터가 있으면 스킵 (idempotent)
- entrypoint 또는 POST /api/v1/crawl/seed-courses 로 실행
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Course, Lecture

logger = logging.getLogger(__name__)

_COURSES = [
    {
        "title": "선형대수학 (Linear Algebra)",
        "source": "MIT 18.06 · Gilbert Strang",
        "category": "math",
        "order_index": 1,
        "lectures": [
            "The Geometry of Linear Equations",
            "Elimination with Matrices",
            "Multiplication and Inverse Matrices",
            "Factorization into A = LU",
            "Transposes, Permutations, Spaces R^n",
            "Column Space and Nullspace",
            "Solving Ax = 0: Pivot Variables, Special Solutions",
            "Solving Ax = b: Row Reduced Form R",
            "Independence, Basis, and Dimension",
            "The Four Fundamental Subspaces",
            "Matrix Spaces; Rank 1; Small World Graphs",
            "Graphs, Networks, Incidence Matrices",
            "Quiz 1 Review",
            "Orthogonal Vectors and Subspaces",
            "Projections onto Subspaces",
            "Projection Matrices and Least Squares",
            "Orthogonal Matrices and Gram-Schmidt",
            "Properties of Determinants",
            "Determinant Formulas and Cofactors",
            "Cramer's Rule, Inverse Matrix, and Volume",
            "Eigenvalues and Eigenvectors",
            "Diagonalization and Powers of A",
            "Differential Equations and exp(At)",
            "Markov Matrices; Fourier Series",
            "Quiz 2 Review",
            "Symmetric Matrices and Positive Definiteness",
            "Complex Matrices; Fast Fourier Transform",
            "Positive Definite Matrices and Minima",
            "Similar Matrices and Jordan Form",
            "Singular Value Decomposition",
            "Linear Transformations and Their Matrices",
            "Change of Basis; Image Compression",
            "Quiz 3 Review",
            "Left and Right Inverses; Pseudoinverse",
        ],
    },
    {
        "title": "확률론과 통계",
        "source": "Stanford CS109 · 확률론 기초",
        "category": "stats",
        "order_index": 2,
        "lectures": [
            "Counting and Sets",
            "Probability Axioms",
            "Conditional Probability",
            "Independence and Bayes' Theorem",
            "Random Variables",
            "Discrete Distributions",
            "Continuous Distributions",
            "Normal Distribution",
            "Joint Distributions",
            "Expectation and Variance",
            "Covariance and Correlation",
            "Central Limit Theorem",
            "Maximum Likelihood Estimation",
            "Hypothesis Testing",
            "Confidence Intervals",
            "Bayesian Inference",
            "Markov Chains",
        ],
    },
    {
        "title": "머신러닝 기초",
        "source": "Stanford CS229 · Andrew Ng",
        "category": "ml",
        "order_index": 3,
        "lectures": [
            "Introduction and Linear Regression",
            "Gradient Descent",
            "Locally Weighted Regression and Logistic Regression",
            "Perceptron and Generalized Linear Models",
            "Gaussian Discriminant Analysis",
            "Naive Bayes",
            "Support Vector Machines",
            "SVM Kernels",
            "Neural Networks",
            "Bias/Variance Tradeoff",
            "Regularization and Model Selection",
            "Decision Trees and Ensemble Methods",
            "Random Forests and Boosting",
            "K-Means Clustering",
            "EM Algorithm",
            "Principal Component Analysis",
            "Independent Component Analysis",
            "Reinforcement Learning Introduction",
            "MDPs and Value Iteration",
            "Policy Gradient",
        ],
    },
    {
        "title": "딥러닝",
        "source": "deeplearning.ai · Andrew Ng",
        "category": "dl",
        "order_index": 4,
        "lectures": [
            "Neural Networks and Deep Learning",
            "Binary Classification and Logistic Regression",
            "Gradient Descent",
            "Vectorization",
            "Shallow Neural Networks",
            "Deep Neural Networks",
            "Practical Aspects: Train/Dev/Test Sets",
            "Bias and Variance",
            "Regularization",
            "Optimization Algorithms",
            "Hyperparameter Tuning",
            "Batch Normalization",
            "Convolutional Neural Networks",
            "Deep Convolutional Models",
            "Object Detection",
            "Face Recognition",
            "Sequence Models",
            "Recurrent Neural Networks",
            "Natural Language Processing with RNN",
            "Transformer Architecture",
            "Attention Mechanism",
            "BERT and GPT",
        ],
    },
    {
        "title": "컴퓨터 비전",
        "source": "Stanford CS231n · Fei-Fei Li",
        "category": "cv",
        "order_index": 5,
        "lectures": [
            "Introduction to Computer Vision",
            "Image Classification",
            "Loss Functions and Optimization",
            "Neural Networks",
            "Convolutional Neural Networks",
            "Training Neural Networks I",
            "Training Neural Networks II",
            "Deep Learning Software",
            "CNN Architectures: AlexNet, VGG, GoogLeNet, ResNet",
            "Recurrent Neural Networks",
            "Detection and Segmentation",
            "Visualizing and Understanding",
            "Generative Models: VAE, GAN",
            "Deep Reinforcement Learning",
            "Efficient Methods for Deep Learning",
            "Adversarial Examples and Robustness",
        ],
    },
    {
        "title": "자연어처리",
        "source": "Stanford CS224n · Christopher Manning",
        "category": "nlp",
        "order_index": 6,
        "lectures": [
            "Introduction and Word Vectors",
            "Word Vectors 2 and Word Senses",
            "Neural Classifiers",
            "Backpropagation",
            "Dependency Parsing",
            "Language Models and RNNs",
            "Vanishing Gradients, LSTMs, GRUs",
            "Seq2Seq, Attention",
            "Transformers",
            "Pretraining",
            "Question Answering",
            "Natural Language Generation",
            "Coreference Resolution",
            "T5 and Large Language Models",
            "Integrating Knowledge in Deep NLP",
            "Social and Ethical Considerations",
            "Future of NLP and DL",
        ],
    },
]


async def seed_courses(db: AsyncSession) -> dict:
    existing = (await db.execute(select(Course))).scalars().first()
    if existing:
        logger.info("[Seed] Course 데이터 이미 존재 — 스킵")
        return {"courses": 0, "lectures": 0}

    courses_added = 0
    lectures_added = 0

    for data in _COURSES:
        course = Course(
            title=data["title"],
            source=data["source"],
            category=data["category"],
            order_index=data["order_index"],
        )
        db.add(course)
        await db.flush()  # id 발급

        for i, title in enumerate(data["lectures"], start=1):
            db.add(Lecture(
                course_id=course.id,
                title=title,
                number=i,
                category=data["category"],
            ))
            lectures_added += 1

        courses_added += 1

    await db.commit()
    logger.info(f"[Seed] Course {courses_added}개, Lecture {lectures_added}개 삽입 완료")
    return {"courses": courses_added, "lectures": lectures_added}
