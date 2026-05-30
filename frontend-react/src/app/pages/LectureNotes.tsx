import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Plus, Trash2, Edit, Save, X, BookOpen, Clock } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { api } from "../../lib/api";

interface Note {
  id: string;
  title: string;
  course: string;
  content: string;
  date: string;
  category: string;
}

function apiToNote(n: any): Note {
  return {
    id: n.id, title: n.title, course: "",
    content: n.content_md ?? "", date: n.updated_at ?? n.created_at ?? "",
    category: "Lecture",
  };
}

export function LectureNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState({
    title: "",
    course: "",
    content: "",
    category: "Lecture",
  });

  // API에서 노트 로드
  useEffect(() => {
    api.getNotes().then((data: any[]) => setNotes(data.map(apiToNote))).catch(() => {
      const saved = localStorage.getItem("lectureNotes");
      if (saved) setNotes(JSON.parse(saved));
    });
  }, []);

  const handleCreateNote = async () => {
    if (!newNote.title || !newNote.content) return;
    try {
      const created: any = await api.createNote({
        title: newNote.title,
        content_md: newNote.content,
      });
      const note = apiToNote(created);
      setNotes(prev => [note, ...prev]);
    } catch {
      // localStorage 폴백
      const note: Note = {
        id: Date.now().toString(),
        title: newNote.title,
        course: newNote.course,
        content: newNote.content,
        date: new Date().toISOString(),
        category: newNote.category,
      };
      const allNotes = localStorage.getItem("lectureNotes");
      const existing = allNotes ? JSON.parse(allNotes) : [];
      localStorage.setItem("lectureNotes", JSON.stringify([note, ...existing]));
      setNotes(prev => [note, ...prev]);
    }
    setNewNote({ title: "", course: "", content: "", category: "Lecture" });
    setIsEditing(false);
  };

  const handleUpdateNote = async () => {
    if (!editingNote) return;
    try {
      await api.updateNote(editingNote.id, {
        title: editingNote.title,
        content_md: editingNote.content,
      });
    } catch { /* localStorage는 자동 동기화 없음 */ }
    setNotes(notes.map((note) => note.id === editingNote.id ? editingNote : note));
    setEditingNote(null);
  };

  const handleDeleteNote = async (id: string) => {
    try { await api.deleteNote(id); } catch { /* 폴백 */ }
    setNotes(notes.filter((note) => note.id !== id));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-16 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              NOTES_SYSTEM.EXE
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
              My Lecture Notes
            </h1>
            <p className="text-lg text-muted-foreground">
              Take notes, organize your thoughts, and track your learning progress.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Note List */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">All Notes</h2>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Note
                </Button>
              </div>

              {notes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No notes yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Create your first note to get started
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card
                      key={note.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setEditingNote(note)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">
                              {note.title}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {note.course}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {note.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(note.date)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Note Editor */}
          <div className="lg:col-span-2">
            {isEditing ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>New Note</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setNewNote({ title: "", course: "", content: "", category: "Lecture" });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input
                      placeholder="Enter note title..."
                      value={newNote.title}
                      onChange={(e) =>
                        setNewNote({ ...newNote, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Course</label>
                    <Input
                      placeholder="e.g., CS101 - Introduction to Programming"
                      value={newNote.course}
                      onChange={(e) =>
                        setNewNote({ ...newNote, course: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <div className="flex gap-2">
                      {["Lecture", "Reading", "Assignment", "Exam Prep"].map((cat) => (
                        <Badge
                          key={cat}
                          variant={newNote.category === cat ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setNewNote({ ...newNote, category: cat })}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Content</label>
                    <Textarea
                      placeholder="Write your notes here..."
                      value={newNote.content}
                      onChange={(e) =>
                        setNewNote({ ...newNote, content: e.target.value })
                      }
                      className="min-h-[400px] font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateNote} className="gap-2">
                      <Save className="w-4 h-4" />
                      Save Note
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setNewNote({ title: "", course: "", content: "", category: "Lecture" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : editingNote ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Edit Note</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this note?")) {
                            handleDeleteNote(editingNote.id);
                            setEditingNote(null);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingNote(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input
                      value={editingNote.title}
                      onChange={(e) =>
                        setEditingNote({ ...editingNote, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Course</label>
                    <Input
                      value={editingNote.course}
                      onChange={(e) =>
                        setEditingNote({ ...editingNote, course: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <div className="flex gap-2">
                      {["Lecture", "Reading", "Assignment", "Exam Prep"].map((cat) => (
                        <Badge
                          key={cat}
                          variant={editingNote.category === cat ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            setEditingNote({ ...editingNote, category: cat })
                          }
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Content</label>
                    <Textarea
                      value={editingNote.content}
                      onChange={(e) =>
                        setEditingNote({ ...editingNote, content: e.target.value })
                      }
                      className="min-h-[400px] font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Last edited: {formatDate(editingNote.date)}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateNote} className="gap-2">
                        <Save className="w-4 h-4" />
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingNote(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-20 text-center">
                  <Edit className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Select a note to view</h3>
                  <p className="text-muted-foreground mb-6">
                    Choose a note from the list or create a new one
                  </p>
                  <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create New Note
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
