interface DrawingCanvasProps {
  onSave?: (dataUrl: string) => void;
}
export function DrawingCanvas({ onSave }: DrawingCanvasProps) {
  return (
    <div className="w-full h-64 bg-muted rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
      <p>Drawing Canvas (준비 중)</p>
      <button
        onClick={() => onSave?.("")}
        className="text-xs underline hover:no-underline"
      >
        저장
      </button>
    </div>
  );
}
