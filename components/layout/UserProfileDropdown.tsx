import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getUserProfile, setUserProfile, getSavedBoats, loadProfileFromServer } from '../../services/storageService';
import { LogOut, ChevronDown, Camera, User } from 'lucide-react';

export default function UserProfileDropdown({ position = 'top' }: { position?: 'top' | 'sidebar' }) {
  const { email, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(getUserProfile());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync profile from server on mount (restores data across devices/deploys)
  useEffect(() => {
    if (!email) return;
    const local = getUserProfile();
    if (!local.name && !local.phone && !local.profileImage) {
      loadProfileFromServer().then(serverProfile => {
        if (serverProfile) {
          setProfile(serverProfile);
          setDraft(serverProfile);
        }
      });
    }
  }, [email]);

  const handleSave = () => {
    setUserProfile(draft);
    setProfile(draft);
    setEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string;
      setDraft(prev => ({ ...prev, profileImage: img }));
    };
    reader.readAsDataURL(file);
  };

  // Compute brands interested from saved boats
  const savedBoats = getSavedBoats();
  const brands = [...new Set(savedBoats.map(b => b.specs.make).filter(Boolean))] as string[];

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : email?.charAt(0).toUpperCase() || '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) { setDraft(profile); setEditing(false); } }}
        className={`flex items-center gap-2 hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors ${position === 'sidebar' ? 'w-full' : ''}`}
      >
        {profile.profileImage ? (
          <img src={profile.profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-yacht-brand/20 text-yacht-brand flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        {position === 'sidebar' && (
          <span className="text-white/60 text-xs truncate flex-1 text-left">{profile.name || email?.split('@')[0] || ''}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute w-80 bg-yacht-800 border border-white/10 rounded-none shadow-2xl z-50 overflow-hidden ${
          position === 'sidebar'
            ? 'left-0 bottom-full mb-2'
            : 'right-0 top-full mt-2'
        }`}>
          {/* Profile Image + Info */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-start gap-3">
              <div className="relative group shrink-0">
                {(editing ? draft.profileImage : profile.profileImage) ? (
                  <img
                    src={editing ? draft.profileImage : profile.profileImage}
                    alt="Profile"
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-yacht-brand/20 text-yacht-brand flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                )}
                {editing && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Full name"
                      value={draft.name}
                      onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:border-yacht-brand/40 focus:outline-none"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={draft.phone}
                      onChange={e => setDraft(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:border-yacht-brand/40 focus:outline-none"
                    />
                    <p className="text-white/30 text-xs truncate">{email}</p>
                    <div className="flex gap-2">
                      <button onClick={handleSave} className="bg-yacht-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-yacht-brand/90 transition-colors">
                        Save
                      </button>
                      <button onClick={() => { setDraft(profile); setEditing(false); }} className="text-white/40 text-xs px-3 py-1.5 hover:text-white transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-white font-medium text-sm truncate">
                      {profile.name || 'Set your name'}
                    </p>
                    <p className="text-white/40 text-xs truncate">{email}</p>
                    {profile.phone && <p className="text-white/40 text-xs mt-0.5">{profile.phone}</p>}
                    <button
                      onClick={() => setEditing(true)}
                      className="text-yacht-brand text-xs mt-1.5 hover:underline"
                    >
                      Edit Profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Brands Interested */}
          <div className="p-4 border-b border-white/10">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Brands Interested</p>
            {brands.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {brands.map(brand => (
                  <span key={brand} className="bg-yacht-brand/10 text-yacht-brand border border-yacht-brand/20 text-xs px-2.5 py-1 rounded-full">
                    {brand}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-xs">Save boats to see your interested brands here.</p>
            )}
          </div>

          {/* Sign Out */}
          <div className="p-3">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
