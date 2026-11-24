import { useEffect, useState } from 'react';
import { rpc } from '../live/controllers';

export interface RoomBrand { name: string; color: string | null; emoji: string | null }
/** The organisation's name, colour and icon for a room, only if that organisation switched branding on. */
export function useRoomBrand(code?: string | null) {
  const [b, setB] = useState<RoomBrand | null>(null);
  useEffect(() => { if (!code) return; rpc<RoomBrand | null>('pp_room_brand', { p_code: code }).then(r => setB(r.data)).catch(() => setB(null)); }, [code]);
  return b;
}
export function BrandBar({ brand }: { brand: RoomBrand | null }) {
  if (!brand) return null;
  return <div className="flex items-center gap-2 rounded-2xl px-4 py-2 font-extrabold text-white" style={{ background: brand.color ?? '#5A36F0' }} data-testid="brand">
    <span aria-hidden className="text-xl">{brand.emoji ?? '🏢'}</span><span dir="auto">{brand.name}</span></div>;
}
