import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fen = searchParams.get('fen');
    
    if (!fen) {
      return NextResponse.json({ error: 'Missing FEN parameter' }, { status: 400 });
    }

    const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}`;
    
    // Server-to-server fetches are not bound by browser CORS policies
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ 
        success: false, 
        reason: `Stockfish API returned status ${res.status}` 
      }, { status: res.status });
    }
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Failed to fetch server-side evaluation' 
    }, { status: 500 });
  }
}
