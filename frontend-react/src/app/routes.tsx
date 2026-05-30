import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/Home";
import { Academics } from "./pages/Academics";
import { CourseCatalog } from "./pages/CourseCatalog";
import { LectureNotes } from "./pages/LectureNotes";
import { MyPage } from "./pages/MyPage";
import { Research } from "./pages/Research";
import { CourseLectures } from "./pages/CourseLectures";
import { CourseLecture } from "./pages/CourseLecture";
import { KnowledgeGraph } from "./pages/KnowledgeGraph";
import { YouTubeImport } from "./pages/YouTubeImport";
import { AddCourse } from "./pages/AddCourse";
import { CurriculumPreview } from "./pages/CurriculumPreview";
import { GeneratedCourses } from "./pages/GeneratedCourses";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "academics", Component: Academics },
      { path: "course-catalog", Component: CourseCatalog },
      { path: "notes", Component: LectureNotes },
      { path: "research", Component: Research },
      { path: "my-page", Component: MyPage },
      { path: "knowledge-graph", Component: KnowledgeGraph },
      { path: "youtube-import", Component: YouTubeImport },
      { path: "generated-courses", Component: GeneratedCourses },
      { path: "curriculum-preview", Component: CurriculumPreview },
      { path: "add-course", Component: AddCourse },
      { path: "course/:courseId", Component: CourseLectures },
      { path: "course/:courseId/lecture/:lectureId", Component: CourseLecture },
    ],
  },
]);
