import { Link } from "react-router";
import { ArrowLeft, Youtube, FolderOpen, Globe, BookOpen } from "lucide-react";

const SOURCES = [
  {
    id: "youtube",
    icon: <Youtube size={22} className="text-red-500" />,
    bg: "bg-red-50",
    label: "YouTube",
    description: "좋아요한 영상이나 재생목록에서 가져오기",
    to: "/youtube-import",
    available: true,
  },
  {
    id: "local",
    icon: <FolderOpen size={22} className="text-amber-500" />,
    bg: "bg-amber-50",
    label: "로컬 파일",
    description: "내 컴퓨터의 영상·PDF·문서 파일 업로드",
    to: null,
    available: false,
  },
  {
    id: "web",
    icon: <Globe size={22} className="text-blue-500" />,
    bg: "bg-blue-50",
    label: "웹 URL",
    description: "강의 페이지나 아티클 URL로 가져오기",
    to: null,
    available: false,
  },
  {
    id: "manual",
    icon: <BookOpen size={22} className="text-violet-500" />,
    bg: "bg-violet-50",
    label: "직접 입력",
    description: "강좌명과 강의 목록을 수동으로 작성",
    to: null,
    available: false,
  },
];

export function AddCourse() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100 px-8 py-4 flex items-center gap-4">
        <Link to="/my-page" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={14} /> My Page
        </Link>
        <h1 className="text-gray-800" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 22 }}>
          Add Course
        </h1>
      </div>

      <div className="max-w-xl mx-auto px-8 py-14">
        <p className="text-sm text-gray-400 mb-8">어디서 강좌를 가져올까요?</p>

        <div className="grid grid-cols-2 gap-3">
          {SOURCES.map((s) => {
            const inner = (
              <div className={`relative flex flex-col gap-4 p-5 rounded-2xl border transition-all h-full
                ${s.available
                  ? "border-gray-150 hover:border-gray-300 hover:shadow-sm cursor-pointer"
                  : "border-gray-100 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">{s.label}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{s.description}</p>
                </div>
                {!s.available && (
                  <span className="absolute top-3 right-3 text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                    준비 중
                  </span>
                )}
              </div>
            );

            return s.available && s.to ? (
              <Link key={s.id} to={s.to} className="block">
                {inner}
              </Link>
            ) : (
              <div key={s.id}>{inner}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
