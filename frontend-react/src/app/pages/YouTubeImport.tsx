import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Youtube, Check, List, ThumbsUp, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../lib/api";

type Tab = "playlists";

interface Playlist {
  id: string;
  title: string;
  channel: string;
  count: number;
  thumbnail: string;
  videos: string[];
  playlist_id: string;
  category?: string;
  is_study?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function YouTubeImport() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null); // null = 확인중
  const [tab, setTab] = useState<Tab>("playlists");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // OAuth 상태 확인
  useEffect(() => {
    api.getYouTubeStatus().then((s: any) => {
      setConnected(s.authenticated === true);
      if (s.authenticated) loadPlaylists();
    }).catch(() => setConnected(false));
  }, []);

  const loadPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const [plData, regData]: [any, any] = await Promise.all([
        api.getPlaylists(),
        api.getRegisteredPlaylists(),
      ]);
      const pls: Playlist[] = (plData.playlists ?? []).map((p: any) => ({
        id: p.playlist_id,
        playlist_id: p.playlist_id,
        title: p.title,
        channel: "",
        count: p.video_count ?? 0,
        thumbnail: p.thumbnail_url ?? "",
        videos: [],
        category: p.category,
        is_study: p.is_study,
      }));
      setPlaylists(pls);
      setRegisteredIds(new Set(regData.playlist_ids ?? []));
    } catch (e) { console.error(e); }
    finally { setLoadingPlaylists(false); }
  };

  const togglePlaylist = (id: string) =>
    setSelectedPlaylists((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllPlaylists = () =>
    setSelectedPlaylists(prev =>
      prev.size === playlists.length ? new Set() : new Set(playlists.map(p => p.id))
    );

  const totalSelected = selectedPlaylists.size;

  const handleImport = async () => {
    if (selectedPlaylists.size === 0) return;
    setSyncing(true);
    try {
      await api.syncPlaylists(Array.from(selectedPlaylists));
      // 202: 백그라운드에서 처리 중 — 바로 이동
      navigate("/course-catalog", { state: { syncing: true } });
    } catch (e) {
      console.error("sync failed", e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-8 py-4 flex items-center gap-4 shrink-0">
        <Link to="/my-page" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={14} /> My Page
        </Link>
        <h1 className="text-gray-800" style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 22 }}>
          YouTube Import
        </h1>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-10">
        {connected === null ? (
          <div className="flex items-center justify-center h-full min-h-80 text-sm text-gray-400">확인 중...</div>
        ) : !connected ? (
          /* ── Connect screen ── */
          <div className="flex flex-col items-center justify-center h-full min-h-80 gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              <Youtube size={32} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-xl text-gray-800 mb-2" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
                Connect your YouTube account
              </h2>
              <p className="text-sm text-gray-400">
                학습 관련 재생목록을 커리큘럼에 가져옵니다
              </p>
            </div>
            <a
              href="/api/v1/youtube/oauth"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <Youtube size={16} />
              Google 계정으로 연동
            </a>
          </div>
        ) : (
          /* ── Selection screen ── */
          <div className="flex flex-col gap-6">
            {/* Connected badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                YouTube 연동됨
              </div>
              <a href="/api/v1/youtube/oauth" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                재인증
              </a>
            </div>

            {/* Tabs — 플레이리스트만 */}
            <div className="flex gap-0 border-b border-gray-100">
              <button
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 border-gray-800 text-gray-800"
              >
                <List size={13} />학습 재생목록
              </button>
            </div>

            {/* Playlist tab */}
            {loadingPlaylists ? (
              <div className="text-sm text-gray-400 text-center py-8">GPT가 플레이리스트를 분석 중입니다...</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs text-gray-400">{playlists.length}개</span>
                  <button onClick={selectAllPlaylists} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    {selectedPlaylists.size === playlists.length ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
                {playlists.map((p) => {
                  const sel = selectedPlaylists.has(p.id);
                  const expanded = expandedPlaylist === p.id;
                  const isReg = registeredIds.has(p.id);
                  return (
                    <div key={p.id} className={`border rounded-xl overflow-hidden transition-all ${sel ? "border-gray-300" : "border-gray-100"}`}>
                      <div
                        onClick={() => togglePlaylist(p.id)}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${sel ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                      >
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt={p.title} className="w-24 h-14 object-cover rounded-lg shrink-0 bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-24 h-14 rounded-lg shrink-0 bg-gray-100 flex items-center justify-center">
                            <Youtube size={20} className="text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-800 truncate">{p.title}</p>
                            {isReg && <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 shrink-0">등록됨</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.category && <span className="mr-1 text-indigo-500">[{p.category}]</span>}
                            {p.count > 0 && `${p.count}개 영상`}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                          sel ? "border-gray-800 bg-gray-800" : "border-gray-300"
                        }`}>
                          {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Import bar */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 -mx-8 px-8 py-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {totalSelected > 0 ? <><span className="text-gray-800 font-medium">{totalSelected}개</span> 선택됨</> : "항목을 선택하세요"}
              </span>
              <button
                onClick={handleImport}
                disabled={totalSelected === 0 || syncing}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-gray-900 text-white hover:bg-gray-700"
              >
                {syncing ? "동기화 중..." : "커리큘럼에 추가"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
