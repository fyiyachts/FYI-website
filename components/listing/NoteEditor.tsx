import { useState, useEffect } from 'react';
import { getNote, setNote } from '../../services/storageService';
import { StickyNote } from 'lucide-react';

interface Props {
  boatId: string;
}

export default function NoteEditor({ boatId }: Props) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(getNote(boatId));
  }, [boatId]);

  const handleSave = () => {
    setNote(boatId, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-yacht-brand" />Private Notes
      </h3>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add your private notes about this yacht..."
        rows={3}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yacht-brand/30 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-white/30 text-xs">{saved ? 'Saved!' : 'Only visible to you'}</span>
        <button onClick={handleSave} className="text-yacht-brand text-xs hover:text-yacht-brand/80 transition-colors">
          Save Note
        </button>
      </div>
    </div>
  );
}
